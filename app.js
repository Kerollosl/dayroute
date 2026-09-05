// app.js — bootstrap and wiring.
//
// The loop that matters: a drag recomputes the whole day from the cached
// matrix, synchronously. Only the road geometry redraw touches the network,
// and it is debounced — which also keeps us inside OSRM's courtesy rate.

import { Store, toMin, toHM, fmtDur, fmtMiles, todayISO } from './store.js';
import { Schedule } from './schedule.js';
import { Tray } from './stops.js';
import { RouteMap } from './map.js';
import * as R from './route.js';
import * as G from './gmaps.js';
import * as geo from './geocode.js';

const $ = (id) => document.getElementById(id);
const els = {
  calendar: $('calendar'), lineOverlay: $('lineOverlay'),
  trayList: $('trayList'), trayCount: $('trayCount'),
  searchInput: $('searchInput'), searchResults: $('searchResults'),
  btnPaste: $('btnPaste'), pasteSheet: $('pasteSheet'), pasteBox: $('pasteBox'),
  totDrive: $('totDrive'), totDist: $('totDist'), totStops: $('totStops'),
  delta: $('delta'), deltaFigure: $('deltaFigure'), deltaLabel: $('deltaLabel'),
  btnOptimize: $('btnOptimize'), btnUndo: $('btnUndo'),
  btnMapsAction: $('btnMapsAction'), btnMapsActionLabel: $('btnMapsActionLabel'), mapsNote: $('mapsNote'),
  dayPrev: $('dayPrev'), dayNext: $('dayNext'), dayToday: $('dayToday'), dayLabel: $('dayLabel'),
  netStatus: $('netStatus'), netStatusText: $('netStatusText'),
  legend: $('legend'), toasts: $('toasts'), lineEmpty: $('lineEmpty'),
  btnOrigin: $('btnOrigin'), originValue: $('originValue'), originSheet: $('originSheet'),
  originAddr: $('originAddr'), originNote: $('originNote'),
  originUseGeo: $('originUseGeo'), originClear: $('originClear'),
  originResults: $('originResults'),
  stopSheet: $('stopSheet'), stopSheetTitle: $('stopSheetTitle'),
  stopName: $('stopName'), stopAddr: $('stopAddr'), stopDwell: $('stopDwell'),
  stopPinned: $('stopPinned'), stopDelete: $('stopDelete'), stopGeoNote: $('stopGeoNote'),
  mapScrim: $('mapScrim'),
};

const store = new Store();
let links = [];
let copiedSignature = null;   // the link content last successfully copied, or null
let lastMatrix = null;        // most recent driving matrix, for live drag constraints

/** Identifies WHAT the link points to, not just that a copy happened — any
 * change here (reorder, added/removed stop, re-optimise) means the copied
 * text on the clipboard no longer matches what's on screen. */
const linkSignature = (ls) => ls.map((l) => l.url).join('|');
let lastDriveBefore = null;
let editingId = null;
let geomToken = 0;

// -- chrome ----------------------------------------------------------------
function toast(msg, kind = 'info') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.dataset.kind = kind;
  t.textContent = msg;                       // textContent only: names are user data
  els.toasts.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 3400);
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * Run a figure up to its value so the saving reads as something that happened,
 * then mark the moment it stops — a count that merely trails off is
 * indistinguishable from one that's still working.
 */
function countTo(el, seconds, sign) {
  const pill = el.closest('.delta');
  if (REDUCED.matches) { el.textContent = sign + fmtDur(seconds); return; }
  pill?.classList.add('is-counting');
  const t0 = performance.now(), ms = 620;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = sign + fmtDur(seconds * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
    else pill?.classList.remove('is-counting');
  };
  requestAnimationFrame(step);
}

function status(text, state = 'ok') {
  els.netStatusText.textContent = text;
  els.netStatus.dataset.state = state;
}

/**
 * The day starts when the day starts — at the earliest stop already on the
 * board, not at a fixed 08:00. Optimising used to walk the clock from
 * DAY_START_MIN regardless, so a 10am-to-4pm day was pulled back two hours
 * purely because the window said it could be. "Least driving" never meant
 * "start earlier". The end bound stays fixed: without it the tail gap is
 * infinite and nothing is ever unfit.
 */
const ORIGIN_ID = '__origin__';

/**
 * The starting point as a routing input: a pinned, zero-dwell stop that is
 * always first. Modelling it this way means the existing anchor machinery
 * carries it — `driveTime` charges the origin-to-first-stop leg, so the
 * optimiser can no longer open wherever it likes for free, and `simulate`
 * walks the clock from it with no dwell to pay.
 *
 * It is never a stop: it has no grid slot, no sequence number, and never
 * counts toward "Stops".
 */
function originStop(dayStartMin) {
  const o = store.origin;
  if (!o || !Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return null;
  return {
    id: ORIGIN_ID, name: o.name || 'Start', address: o.address || '',
    lat: o.lat, lng: o.lng, dwell: 0, pinned: true, origin: true,
    start: toHM(dayStartMin), day: store.day, geoStatus: 'ok',
  };
}

/** Earliest scheduled minute on the board, or 08:00 when the day is empty. */
function firstStartMin(stops) {
  const t = stops.map((s) => toMin(s.start)).filter((v) => Number.isFinite(v));
  return t.length ? Math.min(...t) : 8 * 60;
}

/** Prepend the origin to a routable list, when one is set. */
function withOrigin(routable) {
  const o = originStop(firstStartMin(routable));
  return o ? [o, ...routable] : routable;
}

/** Stops on the current day that have coordinates — the routable population. */
function routableToday() {
  return store.scheduled(store.day).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

function dayWindow(mstops, m = null) {
  const real = mstops.filter((s) => s.id !== ORIGIN_ID);
  const starts = real.map((s) => s.startMin).filter((v) => Number.isFinite(v));
  if (!starts.length) return {};
  const earliest = Math.min(...starts);

  // With a starting point, the day begins by DRIVING, so it has to begin early
  // enough to reach the first stop at the time that stop is actually scheduled.
  // Departing at the first stop's own clock time instead pushes every stop
  // later by the inbound leg — which silently rescheduled the whole day and
  // could make a fixed appointment unreachable ("Can't reach X in time") purely
  // because an origin had been set.
  const origin = mstops.find((s) => s.id === ORIGIN_ID);
  if (!origin || !m) return { dayStart: earliest };

  // Leaving before the first scheduled stop is only ever justified by a FIXED
  // appointment that cannot be reached otherwise — you asked that optimising
  // never drag the day earlier than the first event on the board. A flexible
  // stop needs no lead: it simply shifts to whenever you arrive.
  const firstPinned = real
    .filter((s) => s.pinned)
    .reduce((a, b) => (a == null || b.startMin < a.startMin ? b : a), null);
  if (!firstPinned) return { dayStart: earliest };

  const secs = m.durations?.[m.mi(origin)]?.[m.mi(firstPinned)];
  const lead = Number.isFinite(secs) ? Math.ceil(secs / 60) : 0;
  return { dayStart: Math.min(earliest, firstPinned.startMin - lead) };
}

function renderLegend() {
  els.legend.textContent = '';
  // Read straight from the stylesheet so the legend can never drift from the
  // inks the diagram actually draws with.
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  const items = [
    [v('--text', '#1D1D1F'), 'Fixed'],
    [v('--accent', '#0B7A4B'), 'Flexible'],
    [v('--danger', '#D93025'), "Won't fit"],
  ];
  for (const [c, label] of items) {
    const i = document.createElement('span');
    i.className = 'legend-item';
    const k = document.createElement('i');
    k.className = 'legend-key';
    k.style.background = c;
    const s = document.createElement('span');
    s.textContent = label;
    i.append(k, s);
    els.legend.appendChild(i);
  }
}

function renderDayLabel() {
  const [y, m, d] = store.day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  els.dayLabel.textContent = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// -- the map ---------------------------------------------------------------
const map = new RouteMap(els.mapScrim.parentElement.querySelector('#map'), {
  onPinClick: (id) => openStop(id),
});
map.ready.then((ok) => {
  els.mapScrim.hidden = true;
  if (!ok) {
    els.mapScrim.hidden = false;
    els.mapScrim.querySelector('span').textContent = 'Basemap unavailable — the day still routes';
    return;
  }
  tray.setMapCenter(map.center());
  map.map.on('moveend', () => tray.setMapCenter(map.center()));
  recompute({ fit: true });
});

// -- views -----------------------------------------------------------------
/**
 * Driving seconds between any two stops, straight off the cached matrix — no
 * network, so it can run inside a drag. Returns null when the pair simply
 * isn't known yet (not geocoded, matrix not fetched, routing offline), and
 * every caller treats null as "don't enforce": a constraint that can't be
 * computed must never block the user.
 */
function driveSecondsBetween(a, b) {
  if (!lastMatrix || !a || !b) return null;
  if (!Number.isFinite(a.lat) || !Number.isFinite(b.lat)) return null;
  try {
    const v = lastMatrix.durations?.[lastMatrix.mi(a)]?.[lastMatrix.mi(b)];
    return Number.isFinite(v) ? v : null;
  } catch { return null; }
}

const schedule = new Schedule({
  store, els,
  onEditStop: (id, opts) => openStop(id, opts),
  onHoverStop: (id) => map.setHover(id),
  driveSecondsBetween,
  toast,
});

const tray = new Tray({
  store, els, toast,
  onFocusStop: (id) => { const s = store.byId(id); if (s?.lat) map.flyTo(s); else openStop(id); },
  onHoverStop: (id) => map.setHover(id),
});

// -- the recompute loop ----------------------------------------------------
function withIndex(stops, m) {
  return stops.map((s) => ({
    id: s.id, lat: s.lat, lng: s.lng,
    // `s.dwell || 30` reads an explicit 0 as "missing". The 5-minute floor is
    // there so a real stop always has visible height on the grid; the origin
    // is never drawn and you spend no time at it, so it keeps its true 0.
    // Without this the day began with a phantom half hour parked at home.
    dwell: s.id === ORIGIN_ID ? 0 : Math.max(5, Number.isFinite(s.dwell) ? s.dwell : 30),
    pinned: !!s.pinned, origin: !!s.origin, startMin: toMin(s.start), mi: m.mi(s),
  }));
}

/** Overlap conflicts are always shown, even before Optimise is ever pressed —
 * error prevention, not just after-the-fact detection. */
function currentConflicts() {
  return store.pinnedOverlaps();
}

function emptyTotals() {
  els.totDrive.textContent = '0:00';
  els.totDist.textContent = '0';
  els.delta.hidden = true;
  els.mapsNote.hidden = true;
  links = [];
  setMapsButtonState();
}

/**
 * One button, two jobs: copy the link, then — once it's on the clipboard —
 * offer to open it, since that's the very next thing anyone does with it.
 * It reverts to "Copy" the moment the underlying route actually changes, so
 * "Open" never fires a stale link that no longer matches what's on screen.
 */
function setMapsButtonState() {
  const stale = copiedSignature !== null && copiedSignature !== linkSignature(links);
  if (stale) copiedSignature = null;
  const isOpenState = !stale && copiedSignature !== null && links.length > 0;
  els.btnMapsActionLabel.textContent = isOpenState ? 'Open in Maps' : 'Copy link';
  els.btnMapsAction.classList.toggle('is-ready', isOpenState);
  els.btnMapsAction.disabled = !links.length;
}

/**
 * Whether the map's visible set actually changed since the last recompute —
 * an id added or removed, not merely reordered. A caller can still force it
 * with fit:true (the day-switch handler does), but every other path — create
 * a stop, finish geocoding it, delete one — recentres automatically instead
 * of depending on every call site remembering to ask. That dependency was
 * the actual bug: geocoding a brand-new stop's address never passed fit:true,
 * so the map just sat there after a first-time user's very first action.
 */
let lastRoutableIds = null;
function routableChanged(ids) {
  if (!lastRoutableIds || lastRoutableIds.size !== ids.size) return true;
  for (const id of ids) if (!lastRoutableIds.has(id)) return true;
  return false;
}

async function recompute({ fit = false, unfitIds = null } = {}) {
  const dayStops = store.scheduled();
  const routable = dayStops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  els.totStops.textContent = String(dayStops.length);
  els.btnUndo.disabled = !store.canUndo();
  renderOrigin();

  // Optimising needs two points to reorder between. Leaving the button live on
  // an empty or single-stop day offers an action that provably cannot do
  // anything, which is worse than saying so up front.
  els.btnOptimize.disabled = routable.length < 2;

  // A key for marks that aren't on screen is noise; so is a ruled empty grid
  // with nothing telling you how to fill it.
  const bare = dayStops.length === 0;
  els.lineEmpty.hidden = !bare;
  els.legend.hidden = bare;

  const conflictIds = currentConflicts();
  const routableIds = new Set(routable.map((s) => s.id));
  const shouldFit = fit || routableChanged(routableIds);
  lastRoutableIds = routableIds;

  // A lone or empty day still deserves a sequence number on whatever IS
  // scheduled — routing needs two points, labelling a stop "1" does not.
  const seqByIdEmpty = new Map();
  routable.forEach((s, i) => seqByIdEmpty.set(s.id, i + 1));

  if (routable.length < 2) {
    emptyTotals();
    schedule.setPlan({ seqById: seqByIdEmpty, driveInById: new Map(), unfitIds: new Set(), conflictIds, orderedIds: routable.map((s) => s.id) });
    const originOnly = originStop(firstStartMin(routable));
    const sparse = [...(originOnly ? [{ ...originOnly, isOrigin: true }] : []), ...routable];
    map.setStops(sparse);
    map.setRoute(null);
    if (shouldFit && sparse.length) map.fit(sparse);
    if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
    else status('Ready', 'ok');
    return;
  }

  const routeInput = withOrigin(routable);
  const m = await R.fetchMatrix(routeInput);
  lastMatrix = m;
  const mstops = withIndex(routeInput, m);
  const order = mstops.map((_, i) => i);           // time order IS the route order
  const p = R.plan(order, mstops, m, dayWindow(mstops, m));

  // Sequence numbers and map pins belong to real stops; the origin is neither.
  // The first leg now starts at the origin, so stop 1 finally reports a
  // drive-in figure instead of nothing.
  const seqById = new Map();
  const driveInById = new Map();
  routable.forEach((s, i) => seqById.set(s.id, i + 1));
  p.legs.forEach((leg) => {
    const to = routeInput[leg.to];
    if (to && to.id !== ORIGIN_ID) driveInById.set(to.id, leg.duration);
  });

  schedule.setPlan({ seqById, driveInById, unfitIds: unfitIds || new Set(), conflictIds, orderedIds: routable.map((s) => s.id) });

  els.totDrive.textContent = fmtDur(p.totalDur);
  els.totDist.textContent = fmtMiles(p.totalDist);

  const originPin = originStop(firstStartMin(routable));
  map.setStops([
    ...(originPin ? [{ ...originPin, isOrigin: true }] : []),
    ...routable.map((s) => ({ ...s, unfit: unfitIds?.has(s.id), conflict: conflictIds.has(s.id) })),
  ]);
  if (shouldFit) map.fit(routeInput);

  links = G.buildLinks(routeInput);
  setMapsButtonState();
  const caveat = G.linkCaveat(routeInput, links);
  els.mapsNote.textContent = caveat || '';
  els.mapsNote.hidden = !caveat;

  if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
  else if (p.estimated) status('Estimated — routing offline', 'error');
  else if (!p.feasible) {
    const lateStop = p.lateId ? store.byId(p.lateId) : null;
    status(lateStop ? `Can't reach "${lateStop.name || lateStop.address}" in time` : 'Schedule runs late', 'error');
  }
  else status('Ready', 'ok');

  drawGeometry(routeInput, p.estimated);
}

// Only this touches the network on a drag, and only after things settle.
let geomTimer = null;
function drawGeometry(stops, estimated) {
  clearTimeout(geomTimer);
  const token = ++geomToken;
  geomTimer = setTimeout(async () => {
    if (estimated) {
      map.setRoute({ type: 'LineString', coordinates: stops.map((s) => [s.lng, s.lat]) }, { estimated: true });
      return;
    }
    const g = await R.fetchGeometry(stops);
    if (token !== geomToken) return;                // a newer order superseded this
    if (g) map.setRoute(g.geometry, { estimated: false });
    else map.setRoute({ type: 'LineString', coordinates: stops.map((s) => [s.lng, s.lat]) }, { estimated: true });
  }, 420);
}

// -- starting point --------------------------------------------------------

/** The label shown on the rail row. */
function originLabel(o) {
  if (!o) return 'Set a starting point';
  return o.name || o.address || `${o.lat.toFixed(4)}, ${o.lng.toFixed(4)}`;
}

function renderOrigin() {
  const o = store.origin;
  els.originValue.textContent = originLabel(o);
  els.btnOrigin.classList.toggle('is-unset', !o);
  els.btnOrigin.title = o ? `Starting from ${originLabel(o)}` : 'Set a starting point';
}

/** Ask the browser where we are. Resolves to null on refusal or failure. */
function currentPosition({ timeout = 10000 } = {}) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** Turn a raw position into a named origin, naming it as well as we can. */
async function originFromPosition(pos) {
  const rev = await geo.reverse(pos.lat, pos.lng).catch(() => null);
  return {
    lat: pos.lat, lng: pos.lng, source: 'geo',
    name: 'Current location',
    address: rev?.label || '',
  };
}

/**
 * Adopt the current location as the starting point, but ONLY when the browser
 * can give it to us without a prompt — i.e. permission is already granted.
 *
 * Asking on page load was the bug. A permission request with no user gesture
 * behind it is exactly what Chrome auto-dismisses, and the old code marked the
 * attempt as "asked" before learning the outcome, so a single dismissal
 * permanently disabled the feature: on every later load the position was
 * available and still never used. The prompt now only ever comes from the
 * explicit button in the sheet, which is a real gesture and which always works.
 */
async function seedOriginFromGeolocation() {
  if (store.origin) return;
  let state = null;
  try {
    state = (await navigator.permissions?.query({ name: 'geolocation' }))?.state;
  } catch { /* Permissions API unavailable — stay silent rather than prompt */ }
  if (state !== 'granted') return;
  const pos = await currentPosition({ timeout: 8000 });
  if (!pos || store.origin) return;
  store.setOrigin(await originFromPosition(pos), { checkpoint: false });
  toast('Starting from your current location.', 'ok');
}

// Address suggestions for the starting point, using the same provider and the
// same debounce as the Unscheduled search — typing a full address blind and
// hoping the geocoder agrees is not a reasonable thing to ask of anyone.
let originPick = null;          // the suggestion the field currently reflects
let originHits = [];
let originCursor = -1;
let originTimer = null;
let originAbort = null;

function renderOriginHits(hits) {
  originHits = hits;
  originCursor = -1;
  const box = els.originResults;
  box.textContent = '';
  if (!hits.length) { box.hidden = true; return; }
  hits.forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'search-hit';
    b.setAttribute('aria-selected', 'false');
    const strong = document.createElement('b');
    strong.textContent = h.name || h.label || '';
    const sub = document.createElement('span');
    sub.textContent = h.label || '';
    b.append(strong, sub);
    b.addEventListener('click', () => takeOriginHit(i));
    box.appendChild(b);
  });
  box.hidden = false;
}

function moveOriginCursor(d) {
  if (!originHits.length) return;
  originCursor = (originCursor + d + originHits.length) % originHits.length;
  [...els.originResults.children].forEach((el, i) => {
    el.setAttribute('aria-selected', i === originCursor ? 'true' : 'false');
    if (i === originCursor) el.scrollIntoView({ block: 'nearest' });
  });
}

/** Take a suggestion: it becomes the starting point immediately. */
function takeOriginHit(i) {
  const h = originHits[i];
  if (!h) return;
  originPick = { lat: h.lat, lng: h.lng, label: h.label || h.name || '' };
  els.originAddr.value = originPick.label;
  renderOriginHits([]);
  store.setOrigin({ lat: h.lat, lng: h.lng, name: '', address: originPick.label, source: 'manual' });
  els.originNote.dataset.state = 'ok';
  els.originNote.textContent = `Saved. Starting from ${originPick.label}.`;
  els.originClear.hidden = false;
}

async function searchOrigin(q) {
  originAbort?.abort();
  originAbort = new AbortController();
  try {
    renderOriginHits(await geo.search(q, { near: map.center?.(), signal: originAbort.signal }));
  } catch { /* superseded by a newer keystroke */ }
}

els.originAddr.addEventListener('input', () => {
  clearTimeout(originTimer);
  originPick = null;                       // typing invalidates the last pick
  const q = els.originAddr.value.trim();
  if (q.length < 3) { renderOriginHits([]); return; }
  originTimer = setTimeout(() => searchOrigin(q), 320);
});

els.originAddr.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { renderOriginHits([]); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveOriginCursor(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveOriginCursor(-1); return; }
  if (e.key === 'Enter' && originHits.length) {
    e.preventDefault();
    takeOriginHit(originCursor >= 0 ? originCursor : 0);
  }
});

function openOriginSheet() {
  const o = store.origin;
  els.originAddr.value = o && o.source !== 'geo' ? (o.address || o.name || '') : (o?.address || '');
  els.originNote.textContent = o ? `Currently ${originLabel(o)}.` : '';
  els.originNote.dataset.state = '';
  els.originClear.hidden = !o;
  originPick = null;
  renderOriginHits([]);
  els.originSheet.showModal();
  setTimeout(() => els.originAddr.focus(), 30);
}

els.btnOrigin.addEventListener('click', openOriginSheet);

els.originUseGeo.addEventListener('click', async () => {
  els.originNote.dataset.state = '';
  els.originNote.textContent = 'Finding you…';
  els.originUseGeo.disabled = true;
  try {
    const pos = await currentPosition();
    if (!pos) {
      els.originNote.dataset.state = 'bad';
      els.originNote.textContent = 'Could not get your location. If the browser blocked it, allow location for this site in the address bar, then try again — or type an address below.';
      return;
    }
    const o = await originFromPosition(pos);
    store.setOrigin(o);
    originPick = null;
    els.originAddr.value = o.address || '';
    els.originNote.dataset.state = 'ok';
    els.originNote.textContent = `Saved. Starting from ${o.address || originLabel(o)}.`;
    els.originClear.hidden = false;
  } finally {
    els.originUseGeo.disabled = false;
  }
});

els.originClear.addEventListener('click', () => {
  store.setOrigin(null);
  els.originSheet.close();
  toast('Starting point cleared.', 'info');
});

els.originSheet.addEventListener('close', async () => {
  if (els.originSheet.returnValue !== 'ok') return;
  renderOriginHits([]);
  const typed = els.originAddr.value.trim();
  if (!typed) return;                       // Save with an empty box changes nothing
  const cur = store.origin;
  if (cur && typed === (cur.address || '')) return;   // unchanged, or already taken
  // A suggestion the field still reflects is already resolved; re-geocoding the
  // same string would only risk a different, worse match.
  if (originPick && typed === originPick.label) {
    store.setOrigin({ lat: originPick.lat, lng: originPick.lng, name: '', address: originPick.label, source: 'manual' });
    return;
  }
  status('Finding address…', 'busy');
  const hit = await geo.resolve(typed);
  if (!hit) {
    status('Ready', 'ok');
    toast('Could not find that address.', 'error');
    return;
  }
  store.setOrigin({ lat: hit.lat, lng: hit.lng, name: '', address: hit.label || typed, source: 'manual' });
  status('Ready', 'ok');
});

// -- optimise --------------------------------------------------------------
async function optimise() {
  const routable = store.routable();
  // With a starting point, even two stops have a real best order — which one to
  // drive to first. Without one, two stops read the same either way.
  const floor = store.origin ? 2 : 3;
  if (routable.length < floor) {
    toast(`Add at least ${floor === 2 ? 'two' : 'three'} located stops to optimise.`, 'warn');
    return;
  }

  els.btnOptimize.disabled = true;
  els.btnOptimize.classList.add('is-working');
  status('Optimizing…', 'busy');
  schedule.captureRects();
  try {
    const routeInput = withOrigin(routable);
    const m = await R.fetchMatrix(routeInput);
    const mstops = withIndex(routeInput, m);
    const win = dayWindow(mstops, m);
    const before = R.plan(mstops.map((_, i) => i), mstops, m, win);
    const { order, unfit } = R.optimize(mstops, m, win);

    // The commit and the headline totals use `order` as-is — an unfit stop's
    // real time is never touched. The savings figure alone needs a fair
    // apples-to-apples population: comparing `order` (which EXCLUDES unfit
    // stops) against `before` (which includes everyone) would silently credit
    // "less driving" for a stop that just got dropped from the route, not one
    // that was actually driven more efficiently.
    const fairOrder = unfit.length ? R.comparisonOrder(order, unfit, mstops, m) : order;
    const after = R.plan(fairOrder, mstops, m, win);

    const unfitIds = new Set(unfit.map((i) => routeInput[i].id));

    store.batch(() => {
      order.forEach((idx, k) => {
        const s = routeInput[idx];
        // The origin is pinned, so it is skipped here anyway; the guard states
        // the intent rather than relying on that coincidence.
        if (s.id === ORIGIN_ID || s.pinned) return;  // an appointment keeps its clock time
        store.update(s.id, { start: toHM(after.times[k]) }, { checkpoint: false, silent: true });
      });
    });

    const saved = before.totalDur - after.totalDur;
    els.delta.hidden = false;
    els.delta.dataset.dir = saved >= 0 ? 'better' : 'worse';
    els.deltaLabel.textContent = (saved >= 0 ? 'less driving' : 'more driving')
      + (unfitIds.size ? ` · ${unfitIds.size} excluded` : '');
    countTo(els.deltaFigure, Math.abs(saved), saved >= 0 ? '−' : '+');
    lastDriveBefore = before.totalDur;

    await recompute({ fit: true, unfitIds });
    schedule.playReorder();

    if (unfitIds.size) {
      toast(`${unfitIds.size} stop${unfitIds.size > 1 ? 's' : ''} will not fit the day — marked in the schedule.`, 'warn');
    } else if (saved > 30) {
      toast(`${fmtDur(saved)} less driving.`, 'ok');
    } else {
      toast('Already about as tight as it gets.', 'info');
    }
  } catch {
    toast('Could not optimise — routing service unreachable.', 'error');
    status('Routing offline', 'error');
  } finally {
    els.btnOptimize.disabled = routableToday().length < 2;
    els.btnOptimize.classList.remove('is-working');
  }
}

// -- the stop sheet --------------------------------------------------------
function openStop(id, { isNew = false } = {}) {
  const s = store.byId(id);
  if (!s) return;
  editingId = id;
  els.stopSheetTitle.textContent = isNew ? 'New stop' : 'Edit stop';
  els.stopName.value = s.name || '';
  els.stopAddr.value = s.address || '';
  els.stopDwell.value = String(s.dwell || 30);
  els.stopPinned.checked = !!s.pinned;
  els.stopGeoNote.textContent = s.geoStatus === 'ok' ? 'Located.' : s.geoStatus === 'fail' ? 'Address not found.' : '';
  els.stopGeoNote.dataset.state = s.geoStatus === 'ok' ? 'ok' : s.geoStatus === 'fail' ? 'bad' : '';
  els.stopSheet.showModal();
  setTimeout(() => els.stopName.focus(), 30);
}

els.stopSheet.addEventListener('close', async () => {
  const id = editingId;
  editingId = null;
  if (!id || els.stopSheet.returnValue !== 'ok') return;
  const s = store.byId(id);
  if (!s) return;

  const addr = els.stopAddr.value.trim();
  const changed = addr !== (s.address || '');
  store.update(id, {
    name: els.stopName.value.trim() || addr,
    address: addr,
    dwell: Math.max(5, Number(els.stopDwell.value) || 30),
    pinned: els.stopPinned.checked,
    ...(changed ? { lat: null, lng: null, geoStatus: 'none' } : {}),
  });

  if (changed && addr) {
    status('Locating…', 'busy');
    const hit = await geo.resolve(addr);
    if (!store.byId(id)) return;
    store.update(id, hit
      ? { lat: hit.lat, lng: hit.lng, geoStatus: 'ok' }
      : { geoStatus: 'fail' }, { checkpoint: false });
    if (!hit) toast('That address could not be found.', 'warn');
  }
});

els.stopDelete.addEventListener('click', () => {
  if (editingId) store.remove(editingId);
  editingId = null;
  els.stopSheet.close('cancel');
});

// -- actions ---------------------------------------------------------------
els.btnOptimize.addEventListener('click', optimise);

els.btnUndo.addEventListener('click', () => {
  if (store.undo()) toast('Reverted.', 'info');
});

els.btnMapsAction.addEventListener('click', async () => {
  if (!links.length) return;

  if (copiedSignature === linkSignature(links)) {
    // Already copied and nothing's changed since — this click means "go."
    window.open(links[0].url, '_blank', 'noopener');
    return;
  }

  const text = links.length === 1
    ? links[0].url
    : links.map((l, i) => `Leg ${i + 1} — ${l.from} → ${l.to}\n${l.url}`).join('\n\n');
  const ok = await G.copyText(text);
  if (ok) {
    copiedSignature = linkSignature(links);
    setMapsButtonState();
    toast(links.length > 1 ? `${links.length} leg links copied.` : 'Maps link copied.', 'ok');
  } else {
    toast('Could not reach the clipboard.', 'error');
  }
});

function shiftDay(delta) {
  const [y, m, d] = store.day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  store.setDay(todayISO(dt));
}
els.dayPrev.addEventListener('click', () => shiftDay(-1));
els.dayNext.addEventListener('click', () => shiftDay(1));
els.dayToday.addEventListener('click', () => store.setDay(todayISO()));

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (store.undo()) toast('Reverted.', 'info'); }
  else if (e.key === 'o' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); optimise(); }
  else if (e.key === '[') shiftDay(-1);
  else if (e.key === ']') shiftDay(1);
  else if (e.key === '/') { e.preventDefault(); els.searchInput.focus(); }
});

// -- the one place everything redraws from ---------------------------------
store.addEventListener('change', (e) => {
  renderDayLabel();
  tray.render();
  schedule.refresh();
  recompute({ fit: !!e.detail?.dayChanged });
});

window.addEventListener('resize', () => { map.resize(); schedule.scheduleDraw(); });

renderLegend();
renderDayLabel();
tray.render();
schedule.refresh();
recompute();            // never gated on the map
tray.geocodePending();

// Offer the current location as the starting point, once, without blocking
// startup. Refusal is fine: the app then behaves exactly as it did before.
seedOriginFromGeolocation();
