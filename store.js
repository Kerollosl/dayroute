// store.js — the day's state, persisted locally, with undo.
// A stop is either scheduled (has a day + start) or sitting in the sidings (day === null).

const KEY = 'dayroute.v1';
const UNDO_DEPTH = 40;

export const uid = () => 'S' + Math.random().toString(36).slice(2, 9);

export const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Minutes since midnight -> "HH:MM". */
export const toHM = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** "HH:MM" -> minutes since midnight. */
export const toMin = (hm) => {
  if (!hm) return 0;
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Seconds -> "H:MM". Used for every drive figure on the surface. */
export const fmtDur = (sec) => {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const t = Math.round(sec / 60);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
/**
 * A drive leg, spoken the way a driver reads it: plain minutes under an hour,
 * "H:MM" past it. Shared by the event card and the Line's gap-tick so the same
 * number never reads as two different formats in one view.
 */
export const fmtLeg = (sec) => {
  const m = Math.max(1, Math.round((sec || 0) / 60));
  return m < 60 ? `${m} min` : fmtDur(sec);
};

/** Metres -> miles, one decimal under 100. */
export const fmtMiles = (m) => {
  const mi = (m || 0) / 1609.344;
  return mi >= 100 ? String(Math.round(mi)) : mi.toFixed(1).replace(/\.0$/, '');
};

const blank = () => ({ day: todayISO(), stops: [], origin: null });

function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.stops)) return blank();
  const o = raw.origin;
  return {
    day: typeof raw.day === 'string' ? raw.day : todayISO(),
    // The day's starting point. Not a stop: it has no dwell, no slot on the
    // grid, and never counts toward "Stops". It exists so the optimiser has a
    // real place to leave FROM — without one, the first stop costs nothing to
    // reach and the opening leg is chosen arbitrarily.
    origin: o && Number.isFinite(o.lat) && Number.isFinite(o.lng)
      ? {
          name: String(o.name ?? '').slice(0, 200),
          address: String(o.address ?? '').slice(0, 400),
          lat: o.lat, lng: o.lng,
          source: o.source === 'geo' ? 'geo' : 'manual',
        }
      : null,
    stops: raw.stops.filter(Boolean).map((s) => ({
      id: s.id || uid(),
      name: String(s.name ?? '').slice(0, 200),
      address: String(s.address ?? '').slice(0, 400),
      lat: Number.isFinite(s.lat) ? s.lat : null,
      lng: Number.isFinite(s.lng) ? s.lng : null,
      day: typeof s.day === 'string' ? s.day : null,
      start: typeof s.start === 'string' ? s.start : null,
      dwell: Number.isFinite(s.dwell) ? Math.max(0, s.dwell) : 30,
      pinned: !!s.pinned,
      geoStatus: s.geoStatus === 'ok' || s.geoStatus === 'fail' ? s.geoStatus : (Number.isFinite(s.lat) ? 'ok' : 'none'),
    })),
  };
}

export class Store extends EventTarget {
  constructor() {
    super();
    this.state = blank();
    this._undo = [];
    this._suspend = false;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.state = migrate(raw ? JSON.parse(raw) : null);
    } catch {
      this.state = blank();
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
      this.saveFailed = false;
    } catch {
      this.saveFailed = true;
    }
  }

  /** Snapshot before a user-visible mutation so Undo can step back. */
  checkpoint() {
    if (this._suspend) return;
    this._undo.push(JSON.stringify(this.state));
    if (this._undo.length > UNDO_DEPTH) this._undo.shift();
  }

  canUndo() { return this._undo.length > 0; }

  undo() {
    const prev = this._undo.pop();
    if (!prev) return false;
    this.state = migrate(JSON.parse(prev));
    this.commit({ undo: true });
    return true;
  }

  /** Persist + notify. Pass silent:true for transient recomputes. */
  commit(detail = {}) {
    this.save();
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }

  /** Run several mutations as one undo step. */
  batch(fn) {
    this.checkpoint();
    this._suspend = true;
    try { fn(); } finally { this._suspend = false; }
    this.commit();
  }

  // -- reads ---------------------------------------------------------------
  get day() { return this.state.day; }
  get stops() { return this.state.stops; }
  get origin() { return this.state.origin; }

  /**
   * Set or clear the day's starting point. `null` clears it, which returns the
   * optimiser to picking its own opening stop.
   */
  setOrigin(o, { checkpoint = true } = {}) {
    if (checkpoint) this.checkpoint();
    this.state.origin = o && Number.isFinite(o.lat) && Number.isFinite(o.lng)
      ? {
          name: String(o.name ?? '').slice(0, 200),
          address: String(o.address ?? '').slice(0, 400),
          lat: o.lat, lng: o.lng,
          source: o.source === 'geo' ? 'geo' : 'manual',
        }
      : null;
    this.commit();
  }


  byId(id) { return this.state.stops.find((s) => s.id === id) || null; }

  /**
   * The day's stops in time order. This ordering IS the route.
   * A stop scheduled to a day always carries a real `start` on every path that
   * sets `day` (see `schedule()` and the two call sites in schedule.js/stops.js);
   * a malformed one here would silently collapse to midnight via `toMin(null)`
   * and corrupt both the grid position and the route order, so it is dropped
   * rather than guessed at.
   */
  scheduled(day = this.state.day) {
    return this.state.stops
      .filter((s) => s.day === day && typeof s.start === 'string')
      .sort((a, b) => toMin(a.start) - toMin(b.start) || a.name.localeCompare(b.name));
  }

  /** Scheduled stops that can actually be routed. */
  routable(day = this.state.day) {
    return this.scheduled(day).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  }

  sidings() { return this.state.stops.filter((s) => s.day === null); }

  /**
   * Pure time-arithmetic conflict check: two pinned appointments whose occupied
   * windows [start, start+dwell] overlap. Needs no coordinates, no matrix, no
   * network — a conflict is visible the instant it's created (typed, dragged,
   * or pasted), before geocoding has even resolved. This is the offline half of
   * conflict detection; route.js's `plan()` catches the network-dependent half
   * (two pinned stops far enough apart that travel time alone makes the second
   * unreachable, even with zero interval overlap).
   */
  pinnedOverlaps(day = this.state.day) {
    const pinned = this.scheduled(day)
      .filter((s) => s.pinned)
      .map((s) => ({ id: s.id, a: toMin(s.start), b: toMin(s.start) + Math.max(0, s.dwell || 0) }))
      .sort((x, y) => x.a - y.a);
    const bad = new Set();
    let active = [];
    for (const current of pinned) {
      active = active.filter((other) => current.a < other.b - 0.5);
      if (current.b <= current.a) continue;
      for (const other of active) {
        bad.add(current.id);
        bad.add(other.id);
      }
      active.push(current);
    }
    return bad;
  }

  // -- writes --------------------------------------------------------------
  setDay(day) { this.state.day = day; this.commit({ dayChanged: true }); }

  add(partial, { checkpoint = true } = {}) {
    const stop = {
      id: uid(), name: '', address: '', lat: null, lng: null,
      day: null, start: null, dwell: 30, pinned: false, geoStatus: 'none',
      ...partial,
    };
    if (checkpoint) this.checkpoint();
    this.state.stops.push(stop);
    if (checkpoint) this.commit();
    return stop;
  }

  update(id, patch, { checkpoint = true, silent = false } = {}) {
    const s = this.byId(id);
    if (!s) return null;
    if (checkpoint) this.checkpoint();
    Object.assign(s, patch);
    if (!silent) this.commit();
    return s;
  }

  remove(id) {
    const i = this.state.stops.findIndex((s) => s.id === id);
    if (i < 0) return;
    this.checkpoint();
    this.state.stops.splice(i, 1);
    this.commit();
  }

  /** Move a siding onto the day at a given start, or back to the sidings. */
  schedule(id, day, start) { return this.update(id, { day, start }); }
  unschedule(id) { return this.update(id, { day: null, start: null }); }
}
