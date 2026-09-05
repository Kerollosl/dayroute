// schedule.js — the Line.
//
// A transit diagram orders its stations; a calendar scales its rows by time.
// This does both: stations sit at their real clock positions, so the vertical
// gap between two stops IS the drive leg, drawn to scale and labelled.
//
// Hard rule inherited from gcal-plus: never set `position` on info.el or
// .fc-v-event. FullCalendar sizes events with absolute top/bottom to make them
// proportional to duration; overriding it makes them grow to fit their text.
// The overlay only ever READS geometry.

import { toHM, toMin, fmtDur, fmtLeg } from './store.js';

const TRACK_GUTTER = 18;   // distance from the start of the event column
const LABEL_INSET  = 34;   // where the label begins; matches .fc-v-event margin-left
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const SVGNS = 'http://www.w3.org/2000/svg';

const el = (n, attrs = {}) => {
  const e = document.createElementNS(SVGNS, n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export class Schedule {
  constructor({ store, els, onEditStop, onHoverStop, onChange, driveSecondsBetween, toast }) {
    this.store = store;
    this.els = els;
    this.onEditStop = onEditStop;
    this.onHoverStop = onHoverStop;
    this.driveSecondsBetween = driveSecondsBetween || (() => null);
    this.onChange = onChange;
    this.toast = toast;
    this.plan = null;
    this.selectedId = null;
    // Multi-select: cmd/ctrl-click toggles membership, shift-click range-selects
    // from the last-clicked anchor — ported from gcal-plus's batch-shift model.
    // Plain click keeps its existing meaning (open the edit sheet) untouched.
    this.selectedIds = new Set();
    this._selectAnchor = null;
    this.hoverId = null;
    this._raf = 0;
    this._rects = null;
    this._build();
  }

  _build() {
    const self = this;
    this.cal = new FullCalendar.Calendar(this.els.calendar, {
      initialView: 'timeGridDay',
      initialDate: this.store.day,
      headerToolbar: false,
      allDaySlot: false,
      nowIndicator: true,
      height: '100%',
      expandRows: true,
      slotDuration: '00:30:00',
      slotLabelInterval: '01:00',
      snapDuration: '00:05:00',
      slotMinTime: '06:00:00',
      slotMaxTime: '22:00:00',
      scrollTime: '07:30:00',
      // Equal-width side-by-side columns for concurrent events, not FC's default
      // cascading stagger — a conflict is exactly the moment two events most
      // need to read cleanly, not squeeze into a decreasing-width waterfall.
      slotEventOverlap: false,
      editable: true,
      droppable: true,
      eventDurationEditable: true,
      selectable: true,
      longPressDelay: 500,
      eventLongPressDelay: 500,
      selectLongPressDelay: 500,
      slotLabelFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short' },

      events: (info, ok) => ok(this._events()),

      eventContent: (arg) => self._renderEvent(arg),

      eventClassNames: (arg) => {
        const s = self.store.byId(arg.event.extendedProps.stopId);
        if (!s) return [];
        const c = [];
        if (s.pinned) c.push('is-pinned');
        if (s.geoStatus !== 'ok') c.push('is-nogeo');
        if (self.plan?.unfitIds?.has(s.id)) c.push('is-unfit');
        if (self.plan?.conflictIds?.has(s.id)) c.push('is-conflict');
        if (s.id === self.selectedId) c.push('is-selected');
        if (self.selectedIds.has(s.id)) c.push('is-multiselected');
        return c;
      },

      // Drop a siding onto the Line.
      drop: (info) => {
        const id = info.draggedEl?.dataset?.id;
        if (!id) return;
        const d = info.date;
        self.store.schedule(id, self.store.day, toHM(d.getHours() * 60 + d.getMinutes()));
        info.draggedEl.remove();
      },

      eventMouseEnter: (info) => {
        self.hoverId = info.event.extendedProps.stopId;
        self.onHoverStop?.(self.hoverId);
        self.scheduleDraw();
      },
      eventMouseLeave: () => {
        self.hoverId = null;
        self.onHoverStop?.(null);
        self.scheduleDraw();
      },

      eventDidMount: (info) => {
        // A data attribute only. Never touch info.el.style.position — FC sizes
        // events by absolute top/bottom and overriding it breaks duration.
        info.el.dataset.stopId = info.event.extendedProps.stopId || '';
      },

      eventDrop: (info) => self._commitMove(info, info.jsEvent),
      eventResize: (info) => {
        const s = self.store.byId(info.event.extendedProps.stopId);
        if (!s) return;
        let mins = Math.max(5, Math.round((info.event.end - info.event.start) / 60000));

        // A stop may not grow into the drive it owes the next one. Unknown
        // drive time (not geocoded, routing offline) enforces nothing.
        const startMin = toMin(s.start);
        const { next } = self._neighbours(s.id, startMin);
        if (next) {
          const d = self._driveMin(s, next);
          if (d != null) {
            const maxDwell = toMin(next.start) - d - startMin;
            if (mins > maxDwell) {
              const capped = Math.max(5, Math.round(maxDwell));
              if (capped < mins) {
                self.toast?.(`Capped at ${capped} min — the drive to "${next.name || next.address}" needs ${Math.round(d)} min.`, 'info');
              }
              mins = capped;
            }
          }
        }
        self.store.update(s.id, { dwell: mins });
      },
      eventClick: (info) => {
        const id = info.event.extendedProps.stopId;
        const e = info.jsEvent;

        if (e.shiftKey && self._selectAnchor) {
          self._rangeSelect(self._selectAnchor, id);
          return;
        }
        if (e.metaKey || e.ctrlKey) {
          if (self.selectedIds.has(id)) self.selectedIds.delete(id);
          else self.selectedIds.add(id);
          self._selectAnchor = id;
          self.scheduleDraw();
          self.cal.refetchEvents();
          return;
        }

        // A plain click means "look at this one" — it always opens the sheet,
        // exactly as before, and drops any active batch selection.
        const hadSelection = self.selectedIds.size > 0;
        self.selectedIds.clear();
        self._selectAnchor = id;
        self.selectedId = id;
        if (hadSelection) self.cal.refetchEvents();  // clears stale .is-multiselected classes
        self.onEditStop?.(id);
      },

      // Click an empty slot to create a stop right there.
      select: (info) => {
        const mins = Math.max(15, Math.round((info.end - info.start) / 60000));
        const stop = self.store.add({
          name: '', address: '', day: self.store.day,
          start: toHM(info.start.getHours() * 60 + info.start.getMinutes()),
          dwell: mins,
        });
        self.cal.unselect();
        self.onEditStop?.(stop.id, { isNew: true });
      },

      datesSet: () => self.scheduleDraw(),
    });

    this.cal.render();

    // Sidings become draggable events. The interaction plugin ships inside the
    // global bundle, so no separate plugin script is needed.
    this.dragger = new FullCalendar.Draggable(this.els.trayList, {
      itemSelector: '.siding',
      eventData: (node) => {
        try { return JSON.parse(node.getAttribute('data-event')); } catch { return {}; }
      },
    });

    // A capped pane with FullCalendar's own scroller inside it hides most of the
    // day behind a nested scroll — which directly contradicts "see the whole day
    // as one line". On narrow screens the grid expands and the page scrolls once.
    this._mq = window.matchMedia('(max-width: 900px)');
    this._applyHeight = () => {
      this.cal.setOption('height', this._mq.matches ? 'auto' : '100%');
      this.scheduleDraw();
    };
    this._applyHeight();
    this._mq.addEventListener('change', this._applyHeight);

    const scroller = this.els.calendar.querySelector('.fc-scroller');
    scroller?.addEventListener('scroll', () => this.scheduleDraw(), { passive: true });
    this._ro = new ResizeObserver(() => this.scheduleDraw());
    this._ro.observe(this.els.calendar);
  }

  /**
   * Range-select every stop whose scheduled span overlaps [anchor, target] —
   * gcal-plus's applyRangeSelect, ported: shift-click extends a selection
   * instead of replacing it, matching how every other range-select works.
   */
  _rangeSelect(anchorId, targetId) {
    const stops = this.store.scheduled();
    const anchor = this.store.byId(anchorId), target = this.store.byId(targetId);
    if (!anchor || !target) return;
    const span = (s) => [toMin(s.start), toMin(s.start) + Math.max(5, s.dwell || 30)];
    const [aStart, aEnd] = span(anchor);
    const [tStart, tEnd] = span(target);
    const lo = Math.min(aStart, tStart), hi = Math.max(aEnd, tEnd);
    this.selectedIds.clear();
    for (const s of stops) {
      const [start, end] = span(s);
      if (start < hi && end > lo) this.selectedIds.add(s.id);
    }
    this._selectAnchor = targetId;
    this.scheduleDraw();
    this.cal.refetchEvents();
  }

  /** Driving minutes between two stops, or null when it isn't known. */
  _driveMin(a, b) {
    const secs = this.driveSecondsBetween(a, b);
    return secs == null ? null : secs / 60;
  }

  /** The stops immediately before and after a given time, excluding one id. */
  _neighbours(excludeId, atMin) {
    const others = this.store.scheduled().filter((s) => s.id !== excludeId);
    let prev = null, next = null;
    for (const o of others) {
      const st = toMin(o.start);
      if (st <= atMin) { if (!prev || st > toMin(prev.start)) prev = o; }
      else if (!next || st < toMin(next.start)) next = o;
    }
    return { prev, next };
  }

  /**
   * The window a stop may legally start in, given the commute it owes its
   * neighbours. A null bound means "not known" — the matrix hasn't got that
   * pair yet — and an unknown bound is never enforced.
   */
  _legalWindow(stop, atMin) {
    const dwell = Math.max(5, stop.dwell || 30);
    const { prev, next } = this._neighbours(stop.id, atMin);
    let earliest = null, latest = null;
    if (prev) {
      const d = this._driveMin(prev, stop);
      if (d != null) earliest = toMin(prev.start) + Math.max(5, prev.dwell || 30) + d;
    }
    if (next) {
      const d = this._driveMin(stop, next);
      if (d != null) latest = toMin(next.start) - d - dwell;
    }
    return { prev, next, earliest, latest, dwell };
  }

  /** Exchange two stops' start times, then push the second clear of the commute. */
  _swap(a, b) {
    const aStart = toMin(a.start), bStart = toMin(b.start);
    this.store.batch(() => {
      this.store.update(a.id, { start: toHM(bStart) }, { checkpoint: false, silent: true });
      this.store.update(b.id, { start: toHM(aStart) }, { checkpoint: false, silent: true });
    });
    // After the exchange the pair drives in the opposite direction, which can
    // cost more than the slot they traded allows — settle the later one.
    // `a` received bStart and `b` received aStart, so whichever now holds the
    // SMALLER time is chronologically first. Getting this backwards pushes the
    // wrong stop and turns a clean trade into a shove.
    const first = bStart < aStart ? a : b;
    const second = bStart < aStart ? b : a;
    const d = this._driveMin(first, second);
    if (d == null) return;
    const need = toMin(first.start) + Math.max(5, first.dwell || 30) + d;
    if (toMin(second.start) < need) {
      this.store.update(second.id, { start: toHM(need) });
    }
  }

  /**
   * A drag on a stop that's part of an active multi-selection moves every
   * selected stop by the same time delta — gcal-plus's handleBatchDrag,
   * ported. Dragging a stop that ISN'T selected is an ordinary single move
   * and never disturbs an unrelated existing selection.
   *
   * A single move is also where the commute constraint is enforced: a stop
   * may not land inside the drive time it owes a neighbour. Dropping it
   * short of that clamps to the earliest (or latest) legal minute; dragging
   * it clean past a neighbour is read as intent to reorder, and the two swap.
   */
  _commitMove(info, jsEvent) {
    const s = this.store.byId(info.event.extendedProps.stopId);
    if (!s) return;
    const deltaMin = Math.round((info.event.start - info.oldEvent.start) / 60000);

    if (this.selectedIds.size > 1 && this.selectedIds.has(s.id)) {
      this.store.batch(() => {
        for (const id of this.selectedIds) {
          const other = this.store.byId(id);
          if (!other) continue;
          const newStart = toMin(other.start) + deltaMin;
          this.store.update(id, { day: this.store.day, start: toHM(newStart) }, { checkpoint: false, silent: true });
        }
      });
      return;
    }

    const d = info.event.start;
    const wanted = d.getHours() * 60 + d.getMinutes();
    // Neighbours are resolved from where the stop STARTED, not where it landed.
    // Resolving them at the drop position lets a neighbour you just dragged
    // past silently reclassify from `next` to `prev`, which makes "did this
    // drag cross something?" unanswerable and the swap unreachable.
    const { prev, next, earliest, latest, dwell } = this._legalWindow(s, toMin(s.start));

    // Dragged clean past a neighbour: read as "put these in the other order".
    if (prev && wanted < toMin(prev.start)) {
      if (prev.pinned) {
        this.store.update(s.id, { day: this.store.day, start: toHM(earliest ?? wanted) });
        this.toast?.(`"${prev.name || prev.address}" is a fixed appointment — ${s.name || 'this stop'} placed after it.`, 'warn');
      } else {
        this._swap(s, prev);
        this.toast?.(`Swapped with "${prev.name || prev.address}".`, 'ok');
      }
      return;
    }
    if (next && wanted > toMin(next.start)) {
      if (next.pinned) {
        this.store.update(s.id, { day: this.store.day, start: toHM(latest ?? wanted) });
        this.toast?.(`"${next.name || next.address}" is a fixed appointment — ${s.name || 'this stop'} placed before it.`, 'warn');
      } else {
        this._swap(s, next);
        this.toast?.(`Swapped with "${next.name || next.address}".`, 'ok');
      }
      return;
    }

    // Otherwise hold the commute: clamp into the legal window.
    let start = wanted;
    let clampedTo = null;
    if (earliest != null && start < earliest) { start = earliest; clampedTo = prev; }
    else if (latest != null && start > latest) { start = latest; clampedTo = next; }

    this.store.update(s.id, { day: this.store.day, start: toHM(start) });
    if (clampedTo) {
      const mins = Math.round(this._driveMin(clampedTo === prev ? prev : s, clampedTo === prev ? s : next) || 0);
      this.toast?.(`Held ${mins} min clear of "${clampedTo.name || clampedTo.address}" for the drive.`, 'info');
    }
  }

  _events() {
    const day = this.store.day;
    return this.store.scheduled(day).map((s) => {
      const startMin = toMin(s.start);
      return {
        id: s.id,
        title: s.name || s.address || 'Untitled stop',
        start: `${day}T${toHM(startMin)}:00`,
        end: `${day}T${toHM(startMin + Math.max(5, s.dwell || 30))}:00`,
        extendedProps: { stopId: s.id },
      };
    });
  }

  _renderEvent(arg) {
    const s = this.store.byId(arg.event.extendedProps.stopId);
    const wrap = document.createElement('div');
    wrap.className = 'ev';

    const top = document.createElement('div');
    top.className = 'ev-top';
    const seq = document.createElement('span');
    seq.className = 'ev-seq';
    const i = this.plan?.seqById?.get(s?.id);
    seq.textContent = i ? String(i) : '·';
    const name = document.createElement('span');
    name.className = 'ev-name';
    name.textContent = arg.event.title;
    top.append(seq, name);

    const inConflict = this.plan?.conflictIds?.has(s?.id);
    // A conflict only ever happens between pinned stops, so "Conflict" already
    // says "Fixed" — showing both wastes exactly the width a squeezed
    // side-by-side column has the least of.
    if (s?.pinned && !inConflict) {
      const b = document.createElement('span');
      b.className = 'ev-badge ev-badge--pin';
      b.textContent = 'Fixed';
      top.appendChild(b);
    }
    if (inConflict) {
      const b = document.createElement('span');
      b.className = 'ev-badge ev-badge--unfit';
      b.textContent = 'Conflict';
      top.appendChild(b);
    } else if (this.plan?.unfitIds?.has(s?.id)) {
      const b = document.createElement('span');
      b.className = 'ev-badge ev-badge--unfit';
      b.textContent = "Won't fit";
      top.appendChild(b);
    }

    // The drive-in figure rides the top row, not the address line: a departure
    // board puts the number next to the name because it's the number that must
    // never disappear, and the top row is never hidden at any box height —
    // unlike a second line, which a short-dwell stop may have no room for.
    const drive = this.plan?.driveInById?.get(s?.id);
    if (drive != null) {
      const d = document.createElement('span');
      d.className = 'ev-drive';
      d.textContent = fmtLeg(drive);
      top.appendChild(d);
    }

    const meta = document.createElement('div');
    meta.className = 'ev-meta';
    const rest = s?.geoStatus === 'fail' ? 'no location'
      : s?.geoStatus === 'none' ? 'locating…'
      : s?.address || '';
    if (rest) {
      const a = document.createElement('span');
      a.className = 'ev-addr';
      a.textContent = rest;
      meta.appendChild(a);
    }

    wrap.append(top, meta);
    return { domNodes: [wrap] };
  }

  /**
   * Fit the visible window to the day that actually exists, one hour of air on
   * each side. A fixed 06:00-22:00 window wastes most of the height on an empty
   * evening — which the expanded mobile layout turns into dead scroll.
   */
  _fitWindow() {
    const stops = this.store.scheduled();
    let lo = 8 * 60, hi = 18 * 60;
    if (stops.length) {
      lo = Math.min(...stops.map((s) => toMin(s.start)));
      hi = Math.max(...stops.map((s) => toMin(s.start) + Math.max(5, s.dwell || 30)));
    }
    lo = Math.max(0, Math.floor(lo / 60) * 60 - 60);
    hi = Math.min(24 * 60, Math.ceil(hi / 60) * 60 + 60);
    if (hi - lo < 240) hi = Math.min(24 * 60, lo + 240);
    this.cal.setOption('slotMinTime', toHM(lo) + ':00');
    this.cal.setOption('slotMaxTime', hi >= 1440 ? '24:00:00' : toHM(hi) + ':00');
  }

  /** Recompute events from the store and repaint. */
  refresh() {
    this.cal.gotoDate(this.store.day);
    this.cal.refetchEvents();
    this._fitWindow();
    this.scheduleDraw();
  }

  /** Ordering + leg figures come from route.js; the Line just draws them. */
  setPlan(plan) {
    this.plan = plan;
    this.cal.refetchEvents();
    this.scheduleDraw();
  }

  /** Record where every stop sits, before a reorder changes it. */
  captureRects() {
    this._rects = new Map();
    for (const el of this.els.calendar.querySelectorAll('.fc-v-event')) {
      if (el.dataset.stopId) this._rects.set(el.dataset.stopId, el.getBoundingClientRect().top);
    }
  }

  /**
   * The focal moment: after Optimise, each stop travels from its old time to its
   * new one so the resequencing is watched rather than reported. FLIP — measure,
   * invert, play — so nothing animates a layout property.
   */
  playReorder() {
    const before = this._rects;
    this._rects = null;
    if (!before || REDUCED.matches) return;
    requestAnimationFrame(() => {
      let n = 0;
      for (const el of this.els.calendar.querySelectorAll('.fc-v-event')) {
        const was = before.get(el.dataset.stopId);
        if (was === undefined) continue;
        const dy = was - el.getBoundingClientRect().top;
        if (Math.abs(dy) < 2) continue;
        el.animate(
          [{ transform: `translateY(${dy}px)`, opacity: .75 }, { transform: 'none', opacity: 1 }],
          { duration: 460, delay: Math.min(n++ * 26, 160), easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
        );
      }
      this.scheduleDraw();
    });
  }

  scheduleDraw() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this._draw());
  }

  /**
   * Draw the track. Station y-positions are READ from the rendered events —
   * the overlay never writes layout back into FullCalendar's DOM.
   */
  _draw() {
    const svg = this.els.lineOverlay;
    const host = svg.parentElement;
    if (!svg || !host) return;
    const box = host.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.textContent = '';
    if (!box.width) return;

    // The track lives in the gutter at the start of the event column, never
    // over the time axis. Measure the column itself: .fc-timegrid-axis reports
    // zero width once the column header is hidden, and a hardcoded offset would
    // paint over the hour labels in any locale with wider ones.
    const probe = this.els.calendar.querySelector('.fc-timegrid-col.fc-day, .fc-timegrid-col');
    const label = this.els.calendar.querySelector('.fc-timegrid-slot-label');
    const colLeft = probe
      ? probe.getBoundingClientRect().left - box.left
      : (label ? label.getBoundingClientRect().width : 44);
    // The nominal column boundary isn't enough on its own: the axis text
    // (fc-timegrid-slot-label-cushion) can render wider than its own reserved
    // column at the current font size and overflow past it — measured, not
    // assumed, after the track was found sitting 4.5px inside "7am"'s own
    // rendered text. Clear whichever edge is actually further right.
    const axisText = this.els.calendar.querySelector('.fc-timegrid-slot-label-cushion');
    const axisRight = axisText ? axisText.getBoundingClientRect().right - box.left : 0;
    const TRACK_X = Math.max(20, colLeft, axisRight) + TRACK_GUTTER;

    const nodes = [...this.els.calendar.querySelectorAll('.fc-timegrid-event-harness')];
    const stations = nodes.map((n) => {
      const ev = n.querySelector('.fc-v-event');
      const r = n.getBoundingClientRect();
      return {
        id: ev?.dataset.stopId || null,
        y: r.top - box.top + 9,
        yEnd: r.bottom - box.top,
        node: ev,
      };
    }).filter((st) => st.id && st.y > -50 && st.y < box.height + 50).sort((a, b) => a.y - b.y);

    if (stations.length < 1) return;

    const order = this.plan?.orderedIds || [];
    const idAt = (st) => st.id;

    // Theme inks come from the stylesheet, never hardcoded here — the palette
    // has been replaced once already and every literal in this file silently
    // kept pointing at the old world.
    const cs = getComputedStyle(document.documentElement);
    const C = (name, fallback) => (cs.getPropertyValue(name).trim() || fallback);
    const T = {
      paper: C('--paper', '#E6E1D4'),
      raise: C('--paper-raise', '#FFFFFF'),
      rule: C('--rule', '#C9C2AF'),
      inkStrong: C('--ink-strong', '#141814'),
      inkMid: C('--ink-mid', '#454E49'),
      inkDim: C('--ink-dim', '#5E6661'),
      green: C('--green', '#0E7A46'),
      greenInk: C('--green-ink', '#095430'),
      clay: C('--clay', '#B0431F'),
    };

    const stopOf = (st) => (st.id ? this.store.byId(st.id) : null);
    const endMinOf = (s0) => toMin(s0.start) + Math.max(5, s0.dwell || 30);

    // The line is drawn in segments, not as one undifferentiated stroke, so
    // its thickness carries meaning: heavy where you are stopped, medium where
    // you are actually driving, dashed where you are simply free. A dot in the
    // middle of a gap said none of that.
    for (const st of stations) {
      if (st.yEnd - st.y < 2) continue;
      svg.appendChild(el('line', {
        x1: TRACK_X, y1: st.y, x2: TRACK_X, y2: st.yEnd,
        stroke: T.green, 'stroke-width': 7, 'stroke-linecap': 'round',
      }));
    }

    // Drive legs. The gap between two stops is not one thing: part of it is
    // the drive, the rest is slack. Drawing them proportionally means the
    // shape itself answers "do I have room here?" before you read a number.
    for (let i = 1; i < stations.length; i++) {
      const prev = stations[i - 1], cur = stations[i];
      const gapPx = cur.y - prev.yEnd;
      const secs = this.plan?.driveInById?.get(idAt(cur));
      cur.node?.classList.toggle('has-gap-tick', secs != null && gapPx >= 16);
      if (secs == null || gapPx < 16) continue;

      const prevStop = stopOf(prev), curStop = stopOf(cur);
      const gapMin = prevStop && curStop ? toMin(curStop.start) - endMinOf(prevStop) : 0;
      const driveMin = secs / 60;
      const ratio = gapMin > 0 ? Math.max(0, Math.min(1, driveMin / gapMin)) : 1;
      const driveEndY = prev.yEnd + gapPx * ratio;

      // Driving: solid, still the route's own ink, thinner than a stop.
      svg.appendChild(el('line', {
        x1: TRACK_X, y1: prev.yEnd, x2: TRACK_X, y2: driveEndY,
        stroke: T.green, 'stroke-width': 3,
      }));
      // Slack: the same line, released — dashed and quiet.
      if (driveEndY < cur.y - 1) {
        svg.appendChild(el('line', {
          x1: TRACK_X, y1: driveEndY, x2: TRACK_X, y2: cur.y,
          stroke: T.rule, 'stroke-width': 3, 'stroke-dasharray': '2 4', 'stroke-linecap': 'round',
        }));
      }

      // The duration rides a chip on the driven stretch, not a floating dot.
      const chipY = prev.yEnd + (driveEndY - prev.yEnd) / 2;
      const label = el('text', {
        x: TRACK_X + 14, y: chipY + 3.5, fill: T.greenInk,
        'font-size': '11', 'font-family': 'Archivo, sans-serif',
        'letter-spacing': '.04em', 'font-weight': '700',
      });
      label.textContent = fmtLeg(secs);
      svg.appendChild(label);
      const w = label.getBBox().width;
      const chip = el('rect', {
        x: TRACK_X + 9, y: chipY - 8, width: w + 10, height: 16, rx: 3,
        fill: T.raise, stroke: T.rule, 'stroke-width': 1,
      });
      svg.insertBefore(chip, label);

      // Slack, when there's a meaningful amount of it, is worth naming too —
      // it's the answer to "can another errand fit in here?"
      const slackMin = Math.round(gapMin - driveMin);
      if (slackMin >= 10 && cur.y - driveEndY >= 22) {
        const sl = el('text', {
          x: TRACK_X + 14, y: driveEndY + (cur.y - driveEndY) / 2 + 3.5, fill: T.inkDim,
          'font-size': '11', 'font-family': 'Archivo, sans-serif',
          'letter-spacing': '.04em', 'font-weight': '400',
        });
        sl.textContent = `${slackMin} min free`;
        svg.appendChild(sl);
      }
    }

    // Stations. An appointment is an interchange: a filled ring, not a dot.
    const labelX = Math.max(20, colLeft) + LABEL_INSET;
    stations.forEach((st) => {
      const s = stopOf(st);
      const pinned = !!s?.pinned;
      const conflict = this.plan?.conflictIds?.has(st.id);
      const unfit = conflict || this.plan?.unfitIds?.has(st.id);
      const hot = st.id === this.hoverId || st.id === this.selectedId;
      const ink = unfit ? T.clay : pinned ? T.inkStrong : T.green;
      const r = (pinned ? 7.5 : 5) * (hot ? 1.34 : 1);

      // The tick that joins the station to its label. Without it the ring and
      // the label read as two objects for one stop.
      svg.appendChild(el('line', {
        x1: TRACK_X + r, y1: st.y, x2: labelX - 3, y2: st.y,
        stroke: hot ? ink : T.rule, 'stroke-width': hot ? 1.6 : 1,
      }));
      svg.appendChild(el('circle', {
        cx: TRACK_X, cy: st.y, r,
        fill: T.raise, stroke: ink, 'stroke-width': 3,
      }));
      if (!pinned) svg.appendChild(el('circle', { cx: TRACK_X, cy: st.y, r: hot ? 2.8 : 2, fill: ink }));
      // A struck cross-tick marks a collision specifically — two appointments
      // claiming the same moment — distinct from an errand that simply
      // couldn't find a gap.
      if (conflict) {
        const k = r * 0.62;
        svg.appendChild(el('line', { x1: TRACK_X - k, y1: st.y - k, x2: TRACK_X + k, y2: st.y + k, stroke: ink, 'stroke-width': 2 }));
        svg.appendChild(el('line', { x1: TRACK_X - k, y1: st.y + k, x2: TRACK_X + k, y2: st.y - k, stroke: ink, 'stroke-width': 2 }));
      }
    });
  }

  destroy() {
    this._ro?.disconnect();
    this._mq?.removeEventListener('change', this._applyHeight);
    this.cal?.destroy();
  }
}
