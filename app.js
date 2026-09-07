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
  dayPrev: $('dayPrev'), dayNext: $('dayNext'), dayToday: $('dayToday'), dayLabel: $('dayLabel'), dayPicker: $('dayPicker'),
  netStatus: $('netStatus'), netStatusText: $('netStatusText'),
  legend: $('legend'), toasts: $('toasts'), lineEmpty: $('lineEmpty'),
  btnOrigin: $('btnOrigin'), originValue: $('originValue'), originSheet: $('originSheet'),
  originAddr: $('originAddr'), originNote: $('originNote'),
  originUseGeo: $('originUseGeo'), originClear: $('originClear'),
  originResults: $('originResults'), originForm: $('originForm'),
  stopSheet: $('stopSheet'), stopSheetTitle: $('stopSheetTitle'),
  stopName: $('stopName'), stopAddr: $('stopAddr'), stopDwell: $('stopDwell'),
  stopPinned: $('stopPinned'), stopDelete: $('stopDelete'), stopGeoNote: $('stopGeoNote'),
  stopStart: $('stopStart'),
  stopForm: $('stopForm'), stopDayHint: $('stopDayHint'),
  btnAddStop: $('btnAddStop'), btnFirstStop: $('btnFirstStop'),
  mapsSheet: $('mapsSheet'), mapsLegs: $('mapsLegs'), btnCopyLegs: $('btnCopyLegs'),
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
let stopDraft = null;
let geomToken = 0;
let computeToken = 0;
let dataRevision = 0;
let optimizing = false;

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

/**
 * A key for marks that are not on screen is noise — DESIGN.md states this, but
 * the rule was only applied all-or-nothing at zero stops. A day of one flexible
 * errand still advertised "Fixed" and "Won't fit", two of the three marks being
 * for something not present. Each item now earns its place independently.
 */
function renderLegend({ fixed = false, flexible = false, fault = false } = {}) {
  els.legend.textContent = '';
  // Read straight from the stylesheet so the legend can never drift from the
  // inks the diagram actually draws with.
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  const items = [
    [v('--text', '#1D1D1F'), 'Fixed', fixed],
    [v('--accent', '#0B7A4B'), 'Flexible', flexible],
    [v('--danger', '#D93025'), "Won't fit", fault],
  ].filter(([, , show]) => show);
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
  els.dayPicker.value = store.day;
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
  onCreateStop: (draft) => openNewStop(draft),
  onHoverStop: (id) => map.setHover(id),
  onResolveConflict: resolveConflict,
  driveSecondsBetween,
  toast,
});

/**
 * Move a colliding stop to when the stop it overlaps ends.
 *
 * A conflict was named and then abandoned: the status line counted overlaps
 * while the grid drew the pair as two crushed half-width columns, and pulling
 * two pinned appointments apart by hand was the only way out. Both stops are
 * pinned by definition (`pinnedOverlaps`), so which one yields is a real
 * decision — this moves the one whose badge was pressed, and leaves it pinned,
 * because the person just told us it is the movable one. Undo covers the rest.
 */
function resolveConflict(id) {
  const s = store.byId(id);
  if (!s?.start) return;
  const from = toMin(s.start);
  const endOf = (x) => toMin(x.start) + Math.max(5, x.dwell || 30);

  // The overlapping neighbours that actually cover this stop's start.
  const blockers = store.scheduled()
    .filter((x) => x.id !== id && toMin(x.start) <= from && endOf(x) > from);
  if (!blockers.length) return;

  // Land it after the blocker ENDS plus the drive between them, when the
  // cached matrix knows it. Without the travel allowance the "fix" simply
  // trades a collision for a "Runs late" — technically truthful, but it has
  // not resolved anything the person can act on.
  const last = blockers.reduce((a, x) => (endOf(x) > endOf(a) ? x : a), blockers[0]);
  const drive = driveSecondsBetween(last, s);
  const travel = Number.isFinite(drive) ? Math.ceil(drive / 60) : 0;
  const target = Math.max(...blockers.map(endOf)) + travel;
  if (target + Math.max(5, s.dwell || 30) > R.DAY_END_MIN) {
    toast('Moving this stop would push it past the end of the day.', 'warn');
    return;
  }
  store.update(id, { start: toHM(target) });
  toast(travel
    ? `Moved to ${toHM(target)}, allowing ${travel} min to drive there.`
    : `Moved to ${toHM(target)}.`, 'ok');
}

const tray = new Tray({
  store, els, toast,
  onFocusStop: (id) => openStop(id),
  onHoverStop: (id) => map.setHover(id),
  onPlaceStop: placeInFirstGap,
});

/**
 * Put an unscheduled stop into the first gap in the day that can hold it.
 *
 * The schedule already computes and names its idle time ("78 min free"); the
 * tray already holds what is waiting for it. Nothing connected the two, so the
 * only way to act on a gap was to drag — which is also the one interaction a
 * keyboard cannot perform.
 *
 * Gaps are measured on the clock alone. Drive time between neighbours is NOT
 * subtracted here, because knowing it would need a matrix that includes a stop
 * which is by definition not in the route yet, and PRODUCT.md forbids the drag
 * loop waiting on the network. Placing optimistically is safe now that an
 * infeasible result marks itself on every recompute: if the stop does not
 * really fit, it lands and immediately says "Runs late" rather than lying.
 */
function placeInFirstGap(id) {
  const s = store.byId(id);
  if (!s) return;
  const dwell = Math.max(5, s.dwell || 30);

  const day = store.scheduled()
    .slice()
    .sort((a, b) => toMin(a.start) - toMin(b.start));

  // Candidate windows: before the first stop, between each pair, after the last.
  const windows = [];
  let cursor = R.DAY_START_MIN;
  for (const st of day) {
    const from = toMin(st.start);
    if (from - cursor >= dwell) windows.push(cursor);
    cursor = Math.max(cursor, from + Math.max(5, st.dwell || 30));
  }
  if (R.DAY_END_MIN - cursor >= dwell) windows.push(cursor);

  if (!windows.length) {
    toast(`No gap in the day is long enough for ${dwell} minutes.`, 'warn');
    return;
  }
  store.update(id, { day: store.day, start: toHM(windows[0]) });
  setView('schedule');
  toast(`Scheduled at ${toHM(windows[0])}.`, 'ok');
}

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
const COARSE = window.matchMedia?.('(pointer: coarse)');

function setMapsButtonState() {
  const stale = copiedSignature !== null && copiedSignature !== linkSignature(links);
  if (stale) copiedSignature = null;
  // Copy-then-open is a desktop flow: you copy a link to put it somewhere.
  // On the device that actually drives, there is nowhere to paste it — the
  // next action is always "open this in Maps", so the button starts there.
  const isOpenState = links.length > 0
    && (COARSE?.matches || (!stale && copiedSignature !== null));
  els.btnMapsActionLabel.textContent = links.length > 1 ? `Directions · ${links.length} legs` : isOpenState ? 'Open in Maps' : 'Copy link';
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

async function recompute({ fit = false, unfitIds = null, retry = false } = {}) {
  const token = ++computeToken;
  ++geomToken;
  clearTimeout(geomTimer);
  const dayStops = store.scheduled();
  const routable = dayStops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const routeInput = withOrigin(routable);
  links = [];
  $('btnRetryRoute').hidden = true;
  setMapsButtonState();
  els.totStops.textContent = String(dayStops.length);
  els.btnUndo.disabled = !store.canUndo();
  renderOrigin();

  // Optimising needs two points to reorder between. Leaving the button live on
  // an empty or single-stop day offers an action that provably cannot do
  // anything, which is worse than saying so up front.
  els.btnOptimize.disabled = optimizing || routable.length < (store.origin ? 2 : 3);
  els.btnOptimize.title = store.origin ? 'Reorder flexible stops around fixed appointments' : 'Add at least three located stops, or set a starting point';
  $('mobileTrayCount').textContent = String(store.stops.filter((s) => !s.day).length);

  // A key for marks that aren't on screen is noise; so is a ruled empty grid
  // with nothing telling you how to fill it.
  const bare = dayStops.length === 0;
  els.lineEmpty.hidden = !bare;
  els.legend.hidden = bare;
  $('schedulePane').classList.toggle('is-empty', bare);

  const conflictIds = currentConflicts();
  const routableIds = new Set(routeInput.map((s) => `${s.id}:${s.lat},${s.lng}`));
  const shouldFit = fit || routableChanged(routableIds);
  lastRoutableIds = routableIds;

  // A lone or empty day still deserves a sequence number on whatever IS
  // scheduled — routing needs two points, labelling a stop "1" does not.
  const seqByIdEmpty = new Map();
  routable.forEach((s, i) => seqByIdEmpty.set(s.id, i + 1));

  if (!routable.length || routeInput.length < 2) {
    lastMatrix = null;
    emptyTotals();
    links = G.buildLinks(routable);
    setMapsButtonState();
    renderRouteNotes(dayStops, routable, routeInput);
    schedule.setPlan({ seqById: seqByIdEmpty, driveInById: new Map(), unfitIds: new Set(), conflictIds, orderedIds: routable.map((s) => s.id) });
    const originOnly = originStop(firstStartMin(routable));
    const sparse = [...(originOnly ? [{ ...originOnly, isOrigin: true }] : []), ...routable];
    map.setStops(sparse);
    map.setRoute(null);
    if (shouldFit && sparse.length) map.fit(sparse);
    renderLegend({
      fixed: dayStops.some((s) => s.pinned),
      flexible: dayStops.some((s) => !s.pinned),
      fault: conflictIds.size > 0,
    });
    if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
    else status('Ready', 'ok');
    return;
  }

  els.totDrive.textContent = '…';
  els.totDist.textContent = '…';
  status('Calculating route…', 'busy');
  if (shouldFit) {
    map.setRoute(null);
    map.setStops(routeInput.map((s) => ({ ...s, isOrigin: s.id === ORIGIN_ID })));
    map.fit(routeInput);
  }
  const m = await R.fetchMatrix(routeInput, { refresh: retry });
  if (token !== computeToken) return;
  $('btnRetryRoute').hidden = !m.estimated;
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

  // A stop the clock cannot reach is a fault whether or not Optimize ever ran.
  // `unfitIds` is only ever populated by optimize(), so a day built by hand into
  // an impossible shape — which is the normal way you discover a conflict —
  // showed the legend's red mark on nothing at all, and reported the problem as
  // one line of 12px text in the rail footer, ~900px from the stop it named.
  // plan() already knows: `lateId` is computed on every recompute. Fold it in so
  // the card, the badge and the map pin all carry it at once.
  const marked = new Set(unfitIds || []);
  if (!p.feasible && p.lateId) marked.add(p.lateId);
  schedule.setPlan({ seqById, driveInById, unfitIds: marked, lateId: p.feasible ? null : p.lateId, conflictIds, orderedIds: routable.map((s) => s.id) });

  renderLegend({
    fixed: dayStops.some((s) => s.pinned),
    flexible: dayStops.some((s) => !s.pinned),
    fault: marked.size > 0 || conflictIds.size > 0,
  });

  els.totDrive.textContent = fmtDur(p.totalDur);
  els.totDist.textContent = fmtMiles(p.totalDist);

  const originPin = originStop(firstStartMin(routable));
  map.setStops([
    ...(originPin ? [{ ...originPin, isOrigin: true }] : []),
    ...routable.map((s) => ({ ...s, unfit: marked.has(s.id), conflict: conflictIds.has(s.id) })),
  ]);
  if (shouldFit) map.fit(routeInput);

  links = G.buildLinks(routeInput);
  setMapsButtonState();

  // "Stops 4" alongside a drive time computed from 3 of them is two figures
  // disagreeing about what the day is. Principle 2: never silently drop a stop.
  renderRouteNotes(dayStops, routable, routeInput, p.estimated);

  if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
  else if (!p.feasible) {
    const lateStop = p.lateId ? store.byId(p.lateId) : null;
    status(lateStop ? `Can't reach "${lateStop.name || lateStop.address}" in time` : 'Schedule runs late', 'error');
  }
  else if (p.estimated) status('Estimated drive times — verify in Maps', 'error');
  else status('Ready', 'ok');

  drawGeometry(routeInput, p.estimated);
}

function renderRouteNotes(dayStops, routable, routeInput, estimated = false) {
  const missing = dayStops.length - routable.length;
  const notes = [];
  if (missing) notes.push(`${missing} stop${missing === 1 ? '' : 's'} missing a location. Edit the address to include ${missing === 1 ? 'it' : 'them'} in directions and totals.`);
  if (estimated) notes.push('Road data unavailable for some travel. Times and miles are estimates.');
  const caveat = G.linkCaveat(routeInput, links);
  if (caveat) notes.push(caveat);
  els.mapsNote.textContent = notes.join(' ');
  els.mapsNote.hidden = !notes.length;
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

// A dialog's Cancel must not be a submit button: implicit submission (Enter in
// any text field) fires the FIRST submit button in DOM order, so a plain
// <button value="cancel"> sitting above Save meant Enter discarded the sheet.
// Every Cancel is now type="button" and closes explicitly.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-close]');
  if (b) b.closest('dialog')?.close(b.dataset.close);
});

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
  originAbort?.abort();
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

/**
 * Resolve on submit, and close only once it worked. Letting the dialog close
 * first and reporting the miss in a toast afterwards threw away what the person
 * had typed and looked exactly like the sheet silently failing to save.
 */
els.originForm.addEventListener('submit', async (e) => {
  renderOriginHits([]);
  const typed = els.originAddr.value.trim();
  const cur = store.origin;

  // Nothing to resolve: an empty box, an unchanged value, or a suggestion the
  // field still reflects (already resolved — re-geocoding it could only find a
  // worse match). Let the dialog close normally.
  if (!typed) return;
  if (cur && typed === (cur.address || '')) return;
  if (originPick && typed === originPick.label) {
    store.setOrigin({ lat: originPick.lat, lng: originPick.lng, name: '', address: originPick.label, source: 'manual' });
    return;
  }

  e.preventDefault();
  els.originNote.dataset.state = '';
  els.originNote.textContent = 'Finding that address…';
  const hit = await geo.resolve(typed);
  if (!hit) {
    els.originNote.dataset.state = 'bad';
    els.originNote.textContent = 'Could not find that address. Try picking one of the suggestions, or add the city and state.';
    els.originAddr.focus();
    els.originAddr.select();
    return;                                  // sheet stays open, text intact
  }
  store.setOrigin({ lat: hit.lat, lng: hit.lng, name: '', address: hit.label || typed, source: 'manual' });
  els.originSheet.close('ok');
});

// -- optimise --------------------------------------------------------------
async function optimise() {
  if (optimizing) return;
  const routable = store.routable();
  // With a starting point, even two stops have a real best order — which one to
  // drive to first. Without one, two stops read the same either way.
  const floor = store.origin ? 2 : 3;
  if (routable.length < floor) {
    toast(`Add at least ${floor === 2 ? 'two' : 'three'} located stops to optimise.`, 'warn');
    return;
  }

  optimizing = true;
  const revision = dataRevision;
  els.btnOptimize.disabled = true;
  els.btnOptimize.setAttribute('aria-busy', 'true');
  els.btnOptimize.classList.add('is-working');
  status('Optimizing…', 'busy');
  schedule.captureRects();
  try {
    const routeInput = withOrigin(routable);
    const m = await R.fetchMatrix(routeInput);
    if (revision !== dataRevision) {
      toast('The day changed while calculating. Optimize again when you are ready.', 'info');
      return;
    }
    const mstops = withIndex(routeInput, m);
    const win = dayWindow(mstops, m);
    const before = R.plan(mstops.map((_, i) => i), mstops, m, win);
    const { order, unfit } = R.optimize(mstops, m, win);
    const actual = R.plan(order, mstops, m, win);
    if (!actual.feasible) throw new Error('No feasible route');

    const unfitIds = new Set(unfit.map((i) => routeInput[i].id));

    store.batch(() => {
      order.forEach((idx, k) => {
        const s = routeInput[idx];
        // The origin is pinned, so it is skipped here anyway; the guard states
        // the intent rather than relying on that coincidence.
        if (s.id === ORIGIN_ID || s.pinned) return;  // an appointment keeps its clock time
        store.update(s.id, { start: toHM(actual.times[k]) }, { checkpoint: false, silent: true });
      });
    });

    // Compare the actual resulting schedule, including unchanged unfit stops.
    // An optimistically reinserted comparison route is not the route on screen.
    const committed = withIndex(withOrigin(store.routable()), m);
    const after = R.plan(committed.map((_, i) => i), committed, m, win);
    const saved = before.totalDur - after.totalDur;
    els.delta.hidden = false;
    els.delta.dataset.dir = saved >= 0 ? 'better' : 'worse';
    els.deltaLabel.textContent = (saved >= 0 ? 'less driving' : 'more driving')
      + (unfitIds.size ? ` · ${unfitIds.size} won't fit` : '');
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
    toast('Could not find a workable route. Your stops are unchanged; check fixed times and try again.', 'error');
  } finally {
    optimizing = false;
    els.btnOptimize.disabled = routableToday().length < (store.origin ? 2 : 3);
    els.btnOptimize.removeAttribute('aria-busy');
    els.btnOptimize.classList.remove('is-working');
  }
}

// -- the stop sheet --------------------------------------------------------
function openNewStop(partial = {}) {
  let minute = R.DAY_START_MIN;
  for (const s of store.scheduled()) {
    if (toMin(s.start) - minute >= 30) break;
    minute = Math.max(minute, toMin(s.start) + Math.max(5, s.dwell || 30));
  }
  stopDraft = { name: '', address: '', dwell: 30, day: store.day,
    start: minute + 30 <= R.DAY_END_MIN ? toHM(minute) : '', ...partial };
  openStop(null);
}

function openStop(id) {
  const s = id ? store.byId(id) : stopDraft;
  if (!s) return;
  editingId = id;
  if (id) stopDraft = null;
  els.stopSheetTitle.textContent = id ? 'Edit stop' : 'New stop';
  els.stopDelete.hidden = !id;
  els.stopName.value = s.name || '';
  els.stopAddr.value = s.address || '';
  els.stopDwell.value = String(s.dwell || 30);
  // A stop's time was settable only by dragging it on the grid — so the exact
  // time of a fixed appointment, the product's own central claim, could not be
  // typed by anyone, and could not be set at all without a mouse.
  els.stopStart.value = s.start || '';
  els.stopStart.disabled = false;
  els.stopDayHint.textContent = `Scheduled on ${els.dayLabel.textContent}. Leave the time blank to keep it unscheduled.`;
  els.stopPinned.checked = !!s.pinned;
  els.stopGeoNote.textContent = s.geoStatus === 'ok' ? 'Located.' : s.geoStatus === 'fail' ? 'Address not found.' : '';
  els.stopGeoNote.dataset.state = s.geoStatus === 'ok' ? 'ok' : s.geoStatus === 'fail' ? 'bad' : '';
  els.stopSheet.showModal();
  setTimeout(() => els.stopName.focus(), 30);
}

els.stopForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const s = editingId ? store.byId(editingId) : stopDraft;
  if (!s) return;
  const name = els.stopName.value.trim();
  const addr = els.stopAddr.value.trim();
  const start = els.stopStart.value;
  const dwell = Number(els.stopDwell.value);
  if (!name && !addr) {
    els.stopGeoNote.textContent = 'Add a name or address before saving.';
    els.stopGeoNote.dataset.state = 'bad';
    els.stopName.focus();
    return;
  }
  if (start && toMin(start) + dwell > 24 * 60) {
    els.stopGeoNote.textContent = 'This visit extends past midnight. Choose an earlier time or a shorter visit.';
    els.stopGeoNote.dataset.state = 'bad';
    els.stopStart.focus();
    return;
  }
  const changed = addr !== (s.address || '');
  const patch = {
    name: name || addr,
    address: addr,
    dwell,
    pinned: els.stopPinned.checked,
    start: start || null,
    day: start ? (s.day || store.day) : null,
    ...(changed ? { lat: null, lng: null, geoStatus: 'none' } : {}),
  };
  const id = editingId || store.add(patch).id;
  if (editingId) store.update(id, patch);
  els.stopSheet.close('ok');
  if (start) setView('schedule');
  if (addr && (changed || s.geoStatus !== 'ok')) locateStop(id, addr);
});

async function locateStop(id, address) {
  const hit = await geo.resolve(address);
  const current = store.byId(id);
  if (!current || current.address !== address) return;
  store.update(id, hit
    ? { lat: hit.lat, lng: hit.lng, geoStatus: 'ok' }
    : { geoStatus: 'fail' }, { checkpoint: false });
  if (!hit) toast('Address not found. Edit the stop to try a fuller address, then Save to retry.', 'warn');
}

els.stopSheet.addEventListener('close', () => { editingId = null; stopDraft = null; });
els.btnAddStop.addEventListener('click', () => openNewStop());
els.btnFirstStop.addEventListener('click', () => openNewStop());
$('btnManualStop').addEventListener('click', () => openNewStop({ start: '' }));
$('btnRetryRoute').addEventListener('click', () => recompute({ retry: true }));

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
  if (links.length > 1) {
    els.mapsLegs.replaceChildren();
    links.forEach((leg, i) => {
      const a = document.createElement('a');
      a.className = 'maps-leg';
      a.href = leg.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const title = document.createElement('strong');
      title.textContent = `Open leg ${i + 1}`;
      const detail = document.createElement('span');
      detail.textContent = `${leg.from} → ${leg.to}`;
      a.append(title, detail);
      els.mapsLegs.append(a);
    });
    els.mapsSheet.showModal();
    return;
  }

  if (COARSE?.matches || copiedSignature === linkSignature(links)) {
    // Already copied and nothing's changed since — this click means "go."
    // On a touch device it always means "go"; see setMapsButtonState.
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

els.btnCopyLegs.addEventListener('click', async () => {
  const text = links.map((l, i) => `Leg ${i + 1} — ${l.from} → ${l.to}\n${l.url}`).join('\n\n');
  const ok = await G.copyText(text);
  toast(ok ? 'All leg links copied.' : 'Could not copy. Open a leg directly instead.', ok ? 'ok' : 'error');
});

function setView(view) {
  $('app').dataset.view = view;
  document.querySelectorAll('.view-switch [data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
  requestAnimationFrame(() => {
    schedule.cal.updateSize();
    schedule.scheduleDraw();
    map.resize();
  });
}
document.querySelectorAll('.view-switch [data-view]').forEach((b) => {
  b.addEventListener('click', () => setView(b.dataset.view));
});

function shiftDay(delta) {
  const [y, m, d] = store.day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  store.setDay(todayISO(dt));
}
els.dayPrev.addEventListener('click', () => shiftDay(-1));
els.dayNext.addEventListener('click', () => shiftDay(1));
els.dayToday.addEventListener('click', () => store.setDay(todayISO()));
els.dayPicker.addEventListener('change', () => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(els.dayPicker.value)) store.setDay(els.dayPicker.value);
});

document.addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]') || e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (store.undo()) toast('Reverted.', 'info'); }
  else if (e.key === 'o' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); optimise(); }
  else if (e.key === '[') shiftDay(-1);
  else if (e.key === ']') shiftDay(1);
  else if (e.key === '/') { e.preventDefault(); setView('places'); els.searchInput.focus(); }
});

// -- the one place everything redraws from ---------------------------------
store.addEventListener('change', (e) => {
  ++dataRevision;
  if (!optimizing) els.delta.hidden = true;
  if (els.mapsSheet.open) els.mapsSheet.close();
  document.querySelector('.local-note').textContent = store.saveFailed
    ? 'Not saved — browser storage unavailable. Keep this tab open.' : 'Saved on this browser';
  renderDayLabel();
  tray.render();
  schedule.refresh();
  recompute({ fit: !!e.detail?.dayChanged });
});

window.addEventListener('resize', () => { map.resize(); schedule.scheduleDraw(); });

renderLegend({});
setView('schedule');
renderDayLabel();
tray.render();
schedule.refresh();
recompute();            // never gated on the map
tray.geocodePending();

// Offer the current location as the starting point, once, without blocking
// startup. Refusal is fine: the app then behaves exactly as it did before.
seedOriginFromGeolocation();
