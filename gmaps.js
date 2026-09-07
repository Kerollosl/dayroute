// gmaps.js — the handoff out of the product.
//
// Phone browsers support only 3 waypoints. Use that ceiling everywhere so a
// copied link keeps every stop even when it opens on a different device.

export const MAX_WAYPOINTS = 9;
export const MOBILE_WAYPOINTS = 3;
export const STOPS_PER_LINK = MOBILE_WAYPOINTS + 2;

const pt = (s) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;

/**
 * Build one or more Maps links for an ordered list of stops. Consecutive legs
 * overlap by one stop, so leg 2 starts where leg 1 ended.
 * Coordinates rather than address text: Google never re-geocodes and never
 * guesses a different branch of the same chain.
 */
export function buildLinks(stops) {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!pts.length) return [];
  if (pts.length === 1) {
    const destination = pts[0];
    const q = new URLSearchParams({ api: '1', travelmode: 'driving', destination: pt(destination) });
    return [{ url: `https://www.google.com/maps/dir/?${q}`, from: 'Your location',
      to: destination.name || destination.address, count: 1 }];
  }

  const links = [];
  for (let i = 0; i < pts.length - 1; i += STOPS_PER_LINK - 1) {
    const chunk = pts.slice(i, i + STOPS_PER_LINK);
    if (chunk.length < 2) break;
    const origin = chunk[0];
    const destination = chunk[chunk.length - 1];
    const mid = chunk.slice(1, -1);
    const q = new URLSearchParams({ api: '1', travelmode: 'driving', origin: pt(origin), destination: pt(destination) });
    if (mid.length) q.set('waypoints', mid.map(pt).join('|'));
    links.push({
      url: `https://www.google.com/maps/dir/?${q.toString()}`,
      from: origin.name || origin.address,
      to: destination.name || destination.address,
      count: chunk.length,
    });
  }
  return links;
}

/** What to tell the user about the ceilings, or null when nothing applies. */
export function linkCaveat(stops, links) {
  const n = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)).length;
  if (n < 2) return null;
  if (links.length > 1) {
    return `${n} locations split into ${links.length} legs so every stop works on your phone. Each starts where the last ended.`;
  }
  return null;
}

/** Clipboard with the execCommand fallback for contexts that refuse the API. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
