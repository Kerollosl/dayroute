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
  legend: $('legend'), toasts: $('toasts'),
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

function renderLegend() {
  els.legend.textContent = '';
  // Read straight from the stylesheet so the legend can never drift from the
  // inks the diagram actually draws with.
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => cs.getPropertyValue(n).trim() || f;
  const items = [
    [v('--ink-strong', '#141814'), 'Fixed'],
    [v('--green', '#0E7A46'), 'Flexible'],
    [v('--clay', '#B0431F'), "Won't fit"],
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
    id: s.id, lat: s.lat, lng: s.lng, dwell: Math.max(5, s.dwell || 30),
    pinned: !!s.pinned, startMin: toMin(s.start), mi: m.mi(s),
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
  els.btnMapsActionLabel.textContent = isOpenState ? 'Open' : 'Copy Maps link';
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
    map.setStops(routable);
    map.setRoute(null);
    if (shouldFit && routable.length) map.fit(routable);
    if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
    else status('Ready', 'ok');
    return;
  }

  const m = await R.fetchMatrix(routable);
  lastMatrix = m;
  const mstops = withIndex(routable, m);
  const order = mstops.map((_, i) => i);           // time order IS the route order
  const p = R.plan(order, mstops, m);

  const seqById = new Map();
  const driveInById = new Map();
  routable.forEach((s, i) => seqById.set(s.id, i + 1));
  p.legs.forEach((leg) => driveInById.set(routable[leg.to].id, leg.duration));

  schedule.setPlan({ seqById, driveInById, unfitIds: unfitIds || new Set(), conflictIds, orderedIds: routable.map((s) => s.id) });

  els.totDrive.textContent = fmtDur(p.totalDur);
  els.totDist.textContent = fmtMiles(p.totalDist);

  map.setStops(routable.map((s) => ({ ...s, unfit: unfitIds?.has(s.id), conflict: conflictIds.has(s.id) })));
  if (shouldFit) map.fit(routable);

  links = G.buildLinks(routable);
  setMapsButtonState();
  const caveat = G.linkCaveat(routable, links);
  els.mapsNote.textContent = caveat || '';
  els.mapsNote.hidden = !caveat;

  if (conflictIds.size) status(`${conflictIds.size} appointments overlap`, 'error');
  else if (p.estimated) status('Estimated — routing offline', 'error');
  else if (!p.feasible) {
    const lateStop = p.lateId ? store.byId(p.lateId) : null;
    status(lateStop ? `Can't reach "${lateStop.name || lateStop.address}" in time` : 'Schedule runs late', 'error');
  }
  else status('Ready', 'ok');

  drawGeometry(routable, p.estimated);
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

// -- optimise --------------------------------------------------------------
async function optimise() {
  const routable = store.routable();
  if (routable.length < 3) { toast('Add at least three located stops to optimise.', 'warn'); return; }

  els.btnOptimize.disabled = true;
  els.btnOptimize.classList.add('is-working');
  status('Optimising…', 'busy');
  schedule.captureRects();
  try {
    const m = await R.fetchMatrix(routable);
    const mstops = withIndex(routable, m);
    const before = R.plan(mstops.map((_, i) => i), mstops, m);
    const { order, unfit } = R.optimize(mstops, m);

    // The commit and the headline totals use `order` as-is — an unfit stop's
    // real time is never touched. The savings figure alone needs a fair
    // apples-to-apples population: comparing `order` (which EXCLUDES unfit
    // stops) against `before` (which includes everyone) would silently credit
    // "less driving" for a stop that just got dropped from the route, not one
    // that was actually driven more efficiently.
    const fairOrder = unfit.length ? R.comparisonOrder(order, unfit, mstops, m) : order;
    const after = R.plan(fairOrder, mstops, m);

    const unfitIds = new Set(unfit.map((i) => routable[i].id));

    store.batch(() => {
      order.forEach((idx, k) => {
        const s = routable[idx];
        if (s.pinned) return;                       // an appointment keeps its clock time
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
      toast(`${unfitIds.size} stop${unfitIds.size > 1 ? 's' : ''} will not fit the day — marked on the Line.`, 'warn');
    } else if (saved > 30) {
      toast(`${fmtDur(saved)} less driving.`, 'ok');
    } else {
      toast('Already about as tight as it gets.', 'info');
    }
  } catch {
    toast('Could not optimise — routing service unreachable.', 'error');
    status('Routing offline', 'error');
  } finally {
    els.btnOptimize.disabled = false;
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
