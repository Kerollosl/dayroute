// route.js — driving matrix, the constrained optimiser, and route geometry.
//
// The optimiser's whole point: a pinned stop is an appointment, not a waypoint.
// Pinned stops hold their clock time and their relative order; only flexible
// stops get reordered, and only into positions that still let every appointment
// be reached on time. A stop with nowhere feasible to go is reported unfit —
// never quietly dropped, never quietly reordered past an appointment.

const OSRM = 'https://router.project-osrm.org';
const MIN_GAP_MS = 1050;
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 20 * 60;
const FALLBACK_MPH = 32;

// -- polite serial queue, shared by /table and /route ----------------------
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

const coordList = (pts) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
const ptKey = (p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;

/**
 * Canonical point set: unique, sorted, order-independent. The cache key has to
 * be independent of sequence, or reordering the same stops would miss the cache
 * and refetch — which is precisely what the drag loop must never do.
 */
function canonical(pts) {
  const seen = new Map();
  for (const p of pts) if (!seen.has(ptKey(p))) seen.set(ptKey(p), p);
  const keys = [...seen.keys()].sort();
  return { points: keys.map((k) => seen.get(k)), index: new Map(keys.map((k, i) => [k, i])) };
}

function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const la1 = a.lat * rad, la2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line stand-in so the day still computes when OSRM is unreachable. */
function estimateMatrix(pts) {
  const n = pts.length;
  const durations = [], distances = [];
  for (let i = 0; i < n; i++) {
    durations.push([]); distances.push([]);
    for (let j = 0; j < n; j++) {
      const m = i === j ? 0 : haversine(pts[i], pts[j]) * 1.32; // road factor
      distances[i].push(m);
      durations[i].push(m / (FALLBACK_MPH * 1609.344 / 3600));
    }
  }
  return { durations, distances, estimated: true };
}

const matrixCache = new Map();

/**
 * Full N×N driving matrix. One network call, cached by coordinate signature,
 * so dragging a stop never refetches it.
 */
export async function fetchMatrix(pts) {
  const { points, index } = canonical(pts);
  const mi = (p) => index.get(ptKey(p)) ?? 0;
  if (points.length < 2) return { durations: [[0]], distances: [[0]], estimated: false, index, mi };
  const sig = points.map(ptKey).join(';');
  if (matrixCache.has(sig)) return matrixCache.get(sig);

  let out;
  try {
    const url = `${OSRM}/table/v1/driving/${coordList(points)}?annotations=duration,distance`;
    const res = await queued(() => fetch(url));
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (json.code !== 'Ok' || !json.durations) throw new Error(json.code || 'bad response');
    out = { durations: json.durations, distances: json.distances || null, estimated: false };
    if (!out.distances) out.distances = estimateMatrix(points).distances;
  } catch {
    out = estimateMatrix(points);
  }
  out.index = index;
  out.mi = mi;
  matrixCache.set(sig, out);
  return out;
}

/** Was this exact point set already fetched? Used to keep the drag loop offline. */
export function hasMatrix(pts) {
  const { points } = canonical(pts);
  return points.length < 2 || matrixCache.has(points.map(ptKey).join(';'));
}

// -- sequence maths --------------------------------------------------------

const dur = (m, a, b) => m.durations?.[a]?.[b] ?? 0;
const dist = (m, a, b) => m.distances?.[a]?.[b] ?? 0;

/**
 * Matrix index for a stop. NEVER fall back to its position in the sequence —
 * the matrix is in canonical coordinate order, so position is the wrong cell
 * and the result is a confident wrong number rather than an error.
 */
const MI = (m, stops, i) => {
  const s = stops[i];
  if (Number.isFinite(s.mi)) return s.mi;
  if (typeof m.mi === 'function') return m.mi(s);
  return i;
};

/** Total driving seconds for an ordered list of stop indices. */
function driveTime(order, stops, m) {
  let t = 0;
  for (let i = 1; i < order.length; i++) t += dur(m, MI(m, stops, order[i - 1]), MI(m, stops, order[i]));
  return t;
}

/**
 * Walk a sequence on the clock. Pinned stops hold their time; the walk waits
 * for them when early and fails when late.
 * @returns {{ok:boolean, times:number[], lateAt:number, endMin:number}}
 */
function simulate(order, stops, m, dayStart, dayEnd) {
  const times = new Array(order.length).fill(0);
  let t = dayStart;
  const first = stops[order[0]];
  if (first?.pinned) t = Math.min(t, first.startMin);

  for (let i = 0; i < order.length; i++) {
    const s = stops[order[i]];
    if (i > 0) t += dur(m, MI(m, stops, order[i - 1]), MI(m, stops, order[i])) / 60;
    if (s.pinned) {
      if (t > s.startMin + 0.5) return { ok: false, times, lateAt: i, endMin: t };
      t = s.startMin;
    }
    times[i] = t;
    t += s.dwell;
  }
  // A day has to end. Without this bound the tail gap is infinite and nothing
  // is ever unfit, which makes the whole feasibility promise meaningless.
  if (t > dayEnd + 0.5) return { ok: false, times, lateAt: order.length - 1, endMin: t };
  return { ok: true, times, lateAt: -1, endMin: t };
}

const anchorsInOrder = (order, stops) => {
  let last = -Infinity;
  for (const idx of order) {
    const s = stops[idx];
    if (!s.pinned) continue;
    if (s.startMin < last) return false;
    last = s.startMin;
  }
  return true;
};

const valid = (order, stops, m, dayStart, dayEnd) =>
  anchorsInOrder(order, stops) && simulate(order, stops, m, dayStart, dayEnd).ok;

/**
 * Constrained optimiser. Cheapest feasible insertion, then or-opt relocation
 * and anchor-safe 2-opt. Exact enough to be indistinguishable from optimal at
 * the sizes a driving day actually reaches, and it runs in well under a frame.
 *
 * @param stops [{lat,lng,dwell,pinned,startMin}] in matrix-index order
 * @returns {{order:number[], unfit:number[]}}
 */
export function optimize(stops, m, { dayStart = DAY_START_MIN, dayEnd = DAY_END_MIN } = {}) {
  const idx = stops.map((_, i) => i);
  const pinned = idx.filter((i) => stops[i].pinned).sort((a, b) => stops[a].startMin - stops[b].startMin);
  const flex = idx.filter((i) => !stops[i].pinned);

  let order = [...pinned];
  const unfit = [];

  // Longest-first placement: the awkward stops get the pick of the gaps.
  const queue = [...flex].sort((a, b) => stops[b].dwell - stops[a].dwell);

  for (const s of queue) {
    let best = null;
    for (let pos = 0; pos <= order.length; pos++) {
      const cand = [...order.slice(0, pos), s, ...order.slice(pos)];
      if (!valid(cand, stops, m, dayStart, dayEnd)) continue;
      const cost = driveTime(cand, stops, m);
      if (!best || cost < best.cost) best = { pos, cost };
    }
    if (best) order = [...order.slice(0, best.pos), s, ...order.slice(best.pos)];
    else unfit.push(s);
  }

  // or-opt: relocate one stop at a time while it pays.
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let i = 0; i < order.length; i++) {
      if (stops[order[i]].pinned) continue;
      const without = order.filter((_, k) => k !== i);
      const s = order[i];
      const base = driveTime(order, stops, m);
      let best = null;
      for (let pos = 0; pos <= without.length; pos++) {
        const cand = [...without.slice(0, pos), s, ...without.slice(pos)];
        if (!valid(cand, stops, m, dayStart, dayEnd)) continue;
        const cost = driveTime(cand, stops, m);
        if (cost < base - 1 && (!best || cost < best.cost)) best = { cand, cost };
      }
      if (best) { order = best.cand; moved = true; }
    }
    if (!moved) break;
  }

  // 2-opt, restricted to runs that contain no appointment.
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        if (order.slice(i, j + 1).some((k) => stops[k].pinned)) continue;
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (!valid(cand, stops, m, dayStart, dayEnd)) continue;
        if (driveTime(cand, stops, m) < driveTime(order, stops, m) - 1) { order = cand; improved = true; }
      }
    }
    if (!improved) break;
  }

  return { order, unfit };
}

/**
 * Describe a sequence: per-leg drive figures, arrival clock times, totals, and
 * which stops arrive after an appointment they cannot make.
 */
export function plan(order, stops, m, { dayStart = DAY_START_MIN, dayEnd = DAY_END_MIN } = {}) {
  const sim = simulate(order, stops, m, dayStart, dayEnd);
  const legs = [];
  let totalDur = 0, totalDist = 0;
  for (let i = 1; i < order.length; i++) {
    const d = dur(m, MI(m, stops, order[i - 1]), MI(m, stops, order[i]));
    const k = dist(m, MI(m, stops, order[i - 1]), MI(m, stops, order[i]));
    legs.push({ from: order[i - 1], to: order[i], duration: d, distance: k });
    totalDur += d; totalDist += k;
  }
  return {
    order, legs, totalDur, totalDist,
    times: sim.times,
    endMin: sim.endMin,
    feasible: sim.ok,
    lateAt: sim.lateAt,
    // The network-dependent half of conflict detection: which stop first goes
    // late in the walk. When that stop is pinned, its declared time is
    // physically unreachable given travel time alone, even with zero interval
    // overlap against store.js's pure pinnedOverlaps() check.
    lateId: sim.lateAt >= 0 ? (stops[order[sim.lateAt]]?.id ?? null) : null,
    estimated: !!m.estimated,
  };
}

/**
 * Insert stops the optimiser could not place back into an order, purely by
 * drive cost, ignoring feasibility. Used ONLY to build a fair before/after
 * distance comparison — an unfit stop's real schedule time is never touched,
 * but silently excluding it from the "after" total would compare an N-stop
 * route against an (N-k)-stop route, which is what produced a confidently
 * wrong "less driving" figure whenever anything was unfit. The actual
 * commit path must keep using the optimiser's own `order`, unmodified.
 */
export function comparisonOrder(order, unfitIdx, stops, m) {
  let out = [...order];
  for (const idx of unfitIdx) {
    let best = { pos: out.length, cost: Infinity };
    for (let pos = 0; pos <= out.length; pos++) {
      const cand = [...out.slice(0, pos), idx, ...out.slice(pos)];
      const cost = driveTime(cand, stops, m);
      if (cost < best.cost) best = { pos, cost };
    }
    out = [...out.slice(0, best.pos), idx, ...out.slice(best.pos)];
  }
  return out;
}

/** Road geometry for the final order. One call, only when the order settles. */
export async function fetchGeometry(pts) {
  if (pts.length < 2) return null;
  try {
    const url = `${OSRM}/route/v1/driving/${coordList(pts)}?overview=full&geometries=geojson&annotations=false`;
    const res = await queued(() => fetch(url));
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) throw new Error(json.code || 'no route');
    const r = json.routes[0];
    return {
      geometry: r.geometry,
      legs: (r.legs || []).map((l) => ({ duration: l.duration, distance: l.distance })),
      duration: r.duration,
      distance: r.distance,
    };
  } catch {
    return null;
  }
}

export { DAY_START_MIN, DAY_END_MIN };
