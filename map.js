// map.js — the basemap fired into the same enamel as the interface.
//
// A stock tile set inside a midnight shell is the world half-committed, so the
// style is recoloured at load: every colour in it is parsed, reduced to
// luminance, and mapped onto the enamel ramp. Roads, water and labels then
// belong to the same material as the panels around them, and the route ink is
// the only saturated thing on screen.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// The basemap is recoloured onto the same paper the interface is printed on,
// so the map is a panel of the same document rather than a foreign dark tile
// set dropped into it.
const PAPER  = { r: 0xE6, g: 0xE1, b: 0xD4 };
const DEEP   = { r: 0x45, g: 0x4E, b: 0x49 };
const WATER  = { r: 0xC3, g: 0xD2, b: 0xCC };

const ROUTE_SRC = 'dr-route';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});
const hex = (c) => `#${[c.r, c.g, c.b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`;

let probe = null;
/** Normalise any CSS colour string to rgba via the canvas parser. */
function parseColor(str) {
  if (!probe) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    probe = cv.getContext('2d', { willReadFrequently: true });
  }
  // Two different defaults: an invalid colour leaves fillStyle untouched, so
  // the two readings disagree. Without this, "interpolate" parses as black and
  // every MapLibre expression gets flattened into a colour.
  probe.fillStyle = '#000000';
  probe.fillStyle = str;
  const onBlack = probe.fillStyle;
  probe.fillStyle = '#ffffff';
  probe.fillStyle = str;
  if (onBlack !== probe.fillStyle) return null;
  const resolved = onBlack;
  if (typeof resolved === 'string' && resolved.startsWith('#')) {
    const h = resolved.slice(1);
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const m = /rgba?\(([^)]+)\)/.exec(resolved || '');
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(',').map(Number);
  return { r, g, b, a };
}

const LUMA = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

function enamelise(str, role) {
  const c = parseColor(str);
  if (!c) return str;
  const L = LUMA(c);
  // Light ground: luminance now maps the other way round — dark source pixels
  // become the darker paper tones, bright ones approach the paper itself.
  let out;
  if (role === 'water') out = mix({ r: 0xA8, g: 0xBE, b: 0xB6 }, WATER, L);
  else if (role === 'road') out = mix({ r: 0xB2, g: 0xAA, b: 0x97 }, PAPER, clamp(L * 0.85, 0, 1));
  else if (role === 'label') out = mix(DEEP, { r: 0x7A, g: 0x82, b: 0x7C }, L);
  else if (role === 'halo') out = PAPER;
  else out = mix({ r: 0xD9, g: 0xD3, b: 0xC3 }, PAPER, clamp(L, 0, 1));
  return c.a < 1 ? `rgba(${out.r},${out.g},${out.b},${c.a})` : hex(out);
}

function roleOf(layer, key) {
  const id = layer.id || '';
  if (key.includes('halo')) return 'halo';
  if (layer.type === 'symbol') return 'label';
  if (/water|waterway|ocean|river/.test(id)) return 'water';
  if (/highway|road|rail|aeroway|transit|bridge|tunnel/.test(id)) return 'road';
  return 'ground';
}

/** Recursively rewrite colour strings inside paint values, expressions included. */
function walk(value, role, inExpr = false) {
  if (typeof value === 'string') return parseColor(value) ? enamelise(value, role) : value;
  if (Array.isArray(value)) {
    // First element of an expression is its operator — never a colour.
    if (!inExpr && typeof value[0] === 'string') {
      return [value[0], ...value.slice(1).map((v) => walk(v, role, true))];
    }
    return value.map((v) => walk(v, role, true));
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, role, inExpr);
    return out;
  }
  return value;
}

function tintStyle(style) {
  for (const layer of style.layers || []) {
    if (layer.id === 'background') {
      layer.paint = { ...(layer.paint || {}), 'background-color': hex(PAPER) };
      continue;
    }
    if (!layer.paint) continue;
    const next = {};
    for (const [k, v] of Object.entries(layer.paint)) {
      next[k] = k.includes('color') || k.includes('halo') ? walk(v, roleOf(layer, k)) : v;
    }
    layer.paint = next;
  }
  return style;
}

export class RouteMap {
  constructor(container, { onPinClick } = {}) {
    this.el = typeof container === 'string' ? document.getElementById(container) : container;
    this.onPinClick = onPinClick;
    this.markers = [];
    this.map = null;
    this.ok = false;
    this.ready = this._init().catch((err) => { console.warn('map unavailable:', err); return null; });
  }

  async _init() {
    if (typeof maplibregl === 'undefined' || (maplibregl.supported && !maplibregl.supported())) {
      throw new Error('WebGL unavailable');
    }
    let style;
    try {
      const res = await fetch(STYLE_URL);
      style = tintStyle(await res.json());
    } catch {
      style = { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': hex(PAPER) } }] };
    }

    this.map = new maplibregl.Map({
      container: this.el,
      style,
      center: [-77.15, 38.9],
      zoom: 9.2,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('tile load timed out')), 15000);
      this.map.once('load', () => { clearTimeout(timer); resolve(); });
      this.map.once('error', (e) => { clearTimeout(timer); reject(e?.error || new Error('map error')); });
    });

    this.map.addSource(ROUTE_SRC, { type: 'geojson', lineMetrics: true, data: { type: 'FeatureCollection', features: [] } });
    // Casing then ink: the same two-pass build a printed line diagram uses.
    this.map.addLayer({
      id: 'dr-route-casing', type: 'line', source: ROUTE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 12] },
    });
    this.map.addLayer({
      id: 'dr-route-ink', type: 'line', source: ROUTE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#0E7A46', 1, '#0E7A46'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 14, 6],
      },
    });
    this.map.addLayer({
      id: 'dr-route-est', type: 'line', source: ROUTE_SRC,
      layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#0E7A46',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 5],
        'line-opacity': 0.6,
        'line-dasharray': [2, 1.6],
      },
    });
    this.ok = true;
    return this.map;
  }

  /** Draw the ordered stations. Index is the position in the day. */
  setStops(stops, { activeId = null } = {}) {
    if (!this.map) return;
    for (const m of this.markers) m.remove();
    this.markers = [];

    stops.forEach((s, i) => {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
      const el = document.createElement('div');
      el.className = 'pin' + (s.pinned ? ' is-pinned' : '') + (s.unfit ? ' is-unfit' : '') + (s.conflict ? ' is-conflict' : '') + (s.id === activeId ? ' is-active' : '');
      el.dataset.stopId = s.id;
      // A real pin: a station badge on a stem that points at the actual
      // coordinate, echoing the Line's own ring language (white fill, state
      // ink as the ring) so the map and the diagram read as one system.
      // No `title` attribute — that renders the OS's own unstyled tooltip.
      const tick = document.createElement('div');
      tick.className = 'pin-tick';
      tick.textContent = String(i + 1);
      const stem = document.createElement('div');
      stem.className = 'pin-stem';
      const name = document.createElement('div');
      name.className = 'pin-label';
      name.textContent = s.name || s.address || '';
      el.append(name, tick, stem);
      el.addEventListener('click', (e) => { e.stopPropagation(); this.onPinClick?.(s.id); });
      this.markers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([s.lng, s.lat]).addTo(this.map));
    });
  }

  /** Advance the drawn portion of the route from 0 to 1. */
  _drawOn(ms = 720) {
    cancelAnimationFrame(this._drawRaf);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const paint = (p) => {
      if (!this.map?.getLayer('dr-route-ink')) return;
      const clear = 'rgba(14,122,70,0)';
      // Stops must be STRICTLY ascending: clamp so 0 < q < q+d < 1 always holds.
      const q = Math.min(0.99, Math.max(0.005, p));
      const d = 0.004;
      this.map.setPaintProperty('dr-route-ink', 'line-gradient', p >= 1
        ? ['interpolate', ['linear'], ['line-progress'], 0, '#0E7A46', 1, '#0E7A46']
        : ['interpolate', ['linear'], ['line-progress'],
            0, '#0E7A46', q, '#0E7A46', q + d, clear, 1, clear]);
    };
    if (reduced) { paint(1); return; }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      paint(1 - Math.pow(1 - k, 3));            // ease-out cubic
      if (k < 1) this._drawRaf = requestAnimationFrame(step);
    };
    this._drawRaf = requestAnimationFrame(step);
  }

  /** Lift one pin without redrawing the marker set. */
  setHover(id) {
    for (const m of this.markers) {
      const el = m.getElement();
      el.classList.toggle('is-hover', !!id && el.dataset.stopId === id);
    }
  }

  /** Road geometry when OSRM answered; a straight diagram line when it did not. */
  setRoute(geometry, { estimated = false } = {}) {
    const src = this.map?.getSource(ROUTE_SRC);
    if (!src) return;
    src.setData(geometry
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { estimated }, geometry }] }
      : { type: 'FeatureCollection', features: [] });
    // An estimated line is drawn dashed and dimmed on its own layer, so a
    // straight-line guess is never mistaken for a real road route.
    this.map.setLayoutProperty('dr-route-ink', 'visibility', estimated ? 'none' : 'visible');
    this.map.setLayoutProperty('dr-route-est', 'visibility', estimated ? 'visible' : 'none');
    if (geometry && !estimated) this._drawOn();
  }

  fit(stops) {
    const pts = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    if (!this.map || !pts.length) return;
    if (pts.length === 1) { this.map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 12.5, duration: 500 }); return; }
    const b = new maplibregl.LngLatBounds();
    for (const p of pts) b.extend([p.lng, p.lat]);
    // Explicit per-side padding, never a bare number: the rail and tray overlap
    // the viewport edges and a symmetric pad would hide the first stop.
    this.map.fitBounds(b, { padding: { top: 70, right: 70, bottom: 90, left: 70 }, maxZoom: 14.5, duration: 600 });
  }

  center() {
    if (!this.map) return null;
    const c = this.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }

  flyTo(stop) {
    if (!this.map || !Number.isFinite(stop?.lat)) return;
    this.map.easeTo({ center: [stop.lng, stop.lat], zoom: Math.max(this.map.getZoom(), 13), duration: 500 });
  }

  resize() { this.map?.resize(); }
}
