// gmaps.js — the handoff out of the product.
//
// Google's consumer directions URL takes at most 9 waypoints, so 11 stops per
// link (origin + 9 + destination). Mobile browsers honour only 3 — and mobile
// is exactly where this link gets opened. Neither ceiling is hidden: a long day
// splits into chained legs, and the mobile limit is stated where it applies.

export const MAX_WAYPOINTS = 9;
export const STOPS_PER_LINK = MAX_WAYPOINTS + 2;
export const MOBILE_WAYPOINTS = 3;

const pt = (s) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;

/**
 * Build one or more Maps links for an ordered list of stops. Consecutive legs
 * overlap by one stop, so leg 2 starts where leg 1 ended.
 * Coordinates rather than address text: Google never re-geocodes and never
 * guesses a different branch of the same chain.
 */
export function buildLinks(stops) {
  const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (pts.length < 2) return [];

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
  const n = stops.filter((s) => Number.isFinite(s.lat)).length;
  if (n < 2) return null;
  if (links.length > 1) {
    return `${n} stops exceeds Google's 9-waypoint limit, so this is split into ${links.length} legs. Each starts where the last ended.`;
  }
  if (n - 2 > MOBILE_WAYPOINTS) {
    return `Opened in a phone browser, Google honours only ${MOBILE_WAYPOINTS} waypoints. The Google Maps app takes all ${n - 2}.`;
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
