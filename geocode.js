// geocode.js — keyless address lookup.
// Photon leads (better at bare place names); Nominatim backs it up for structured
// addresses. Both are courtesy endpoints capped near 1 req/s, so every call goes
// through one serialized queue and every result is cached forever — an address
// does not move, so there is nothing for a TTL to protect.

const CACHE_KEY = 'dayroute.geocache.v1';
const MIN_GAP_MS = 1100;
const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const norm = (q) => String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');

let cache = new Map();
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) cache = new Map(Object.entries(JSON.parse(raw)));
} catch { /* unreadable cache is an empty cache, never a failure */ }

let flushTimer = null;
function persist() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache))); } catch {}
  }, 400);
}

export const cacheSize = () => cache.size;

// -- one queue, one request at a time, never faster than the policy ---------
let chain = Promise.resolve();
let lastAt = 0;

function queued(fn) {
  const run = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try { return await fn(); } finally { lastAt = Date.now(); }
  });
  chain = run.catch(() => {});
  return run;
}

async function getJSON(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/** Compose a readable second line from Photon's address parts. */
function photonLabel(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  return [street || null, p.city || p.county || null, p.state || null, p.countrycode === 'US' ? null : p.country]
    .filter(Boolean).join(', ');
}

function fromPhoton(json) {
  return (json?.features || [])
    .filter((f) => Array.isArray(f?.geometry?.coordinates))
    .map((f) => {
      const p = f.properties || {};
      const [lng, lat] = f.geometry.coordinates;
      return { name: p.name || p.street || p.city || 'Unnamed', label: photonLabel(p), lat, lng };
    });
}

function fromNominatim(json) {
  return (json || [])
    .filter((r) => r && r.lat && r.lon)
    .map((r) => {
      const parts = String(r.display_name || '').split(',').map((s) => s.trim());
      return {
        name: r.name || parts[0] || 'Unnamed',
        label: parts.slice(1, 4).join(', '),
        lat: Number(r.lat),
        lng: Number(r.lon),
      };
    });
}

/**
 * Typeahead. Biased to the map's centre when one is supplied, so "costco"
 * finds the nearby one rather than the most famous one.
 */
/** A query that opens with a house number is someone typing a street address. */
const looksLikeStreetAddress = (q) => /^\s*\d+[a-z]?\s+\S/i.test(q);

export async function search(query, { near = null, limit = 6, signal } = {}) {
  const q = norm(query);
  if (q.length < 3) return [];
  let url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=${limit}`;
  if (near && Number.isFinite(near.lat)) url += `&lat=${near.lat.toFixed(4)}&lon=${near.lng.toFixed(4)}`;

  const nurl = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
  const askPhoton = () => queued(() => getJSON(url, signal)).then(fromPhoton);
  const askNominatim = () => queued(() => getJSON(nurl, signal)).then(fromNominatim);

  // Route to ONE provider rather than merging both: every call goes through a
  // 1.1s rate-limit queue, so asking twice in sequence doubled the latency of a
  // keystroke-driven suggestion list to about ten seconds.
  //
  // Photon ranks named features above street addresses — "1500 wilson blvd"
  // returned the bus stops ON Wilson Blvd before the building itself — while
  // Nominatim resolves house numbers properly but is weaker on bare place
  // names. So a query that opens with a house number goes to Nominatim, and
  // everything else to Photon. Only an empty result pays for the second call.
  const [first, second] = looksLikeStreetAddress(q)
    ? [askNominatim, askPhoton]
    : [askPhoton, askNominatim];

  // Providers happily return the same place twice at slightly different
  // coordinates (a building and its entrance node, say); a suggestion list that
  // offers the identical line twice looks broken.
  const dedupe = (hits) => {
    const seen = new Set();
    return hits.filter((h) => {
      const k = `${(h.name || '').toLowerCase()}|${(h.label || '').toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  try {
    const hits = dedupe(await first());
    if (hits.length) return hits.slice(0, limit);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
  }
  try {
    return dedupe(await second()).slice(0, limit);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return [];
  }
}

/**
 * Resolve one address to a point. Cached forever, including misses — a query
 * that failed will fail the same way next time, and re-asking is rude.
 * @returns {Promise<{lat:number,lng:number,label:string}|null>}
 */
export async function resolve(address) {
  const q = norm(address);
  if (!q) return null;
  if (cache.has(q)) return cache.get(q);

  let hit = null;
  try {
    hit = fromPhoton(await queued(() => getJSON(`${PHOTON}?q=${encodeURIComponent(q)}&limit=1`)))[0] || null;
  } catch { /* fall through to the backup */ }

  if (!hit) {
    try {
      const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
      hit = fromNominatim(await queued(() => getJSON(url)))[0] || null;
    } catch { /* both providers down or offline; cache nothing */ }
  }

  const value = hit ? { lat: hit.lat, lng: hit.lng, label: hit.label || hit.name } : null;
  cache.set(q, value);
  persist();
  return value;
}

/**
 * Coordinates to a readable address. Used for the starting point when it comes
 * from the browser's position, so it reads as a place rather than a pair of
 * decimals. A failure is not an error: the caller falls back to a plain label
 * and the coordinates still route perfectly well.
 */
export async function reverse(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `@${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);
  let label = null;
  try {
    const url = `${NOMINATIM.replace('/search', '/reverse')}?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`;
    const j = await queued(() => getJSON(url));
    label = j && typeof j.display_name === 'string' ? j.display_name : null;
  } catch { /* offline or throttled — the coordinates are still usable */ }
  const value = label ? { lat, lng, label } : null;
  cache.set(key, value);
  persist();
  return value;
}

/** Resolve many, in order, respecting the same queue. Reports progress. */
export async function resolveAll(addresses, onEach) {
  const out = [];
  for (const a of addresses) {
    const r = await resolve(a);
    out.push(r);
    onEach?.(a, r, out.length, addresses.length);
  }
  return out;
}
