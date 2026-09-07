// stops.js — the sidings: unscheduled stops, list paste, and place search.

import * as geo from './geocode.js';

/** Quote-aware CSV splitter (ported from vacation-map-plotter, which got it right). */
export function parseCSVLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === ',' && !q) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const NAME_KEYS = ['name', 'title', 'label', 'place', 'stop', 'restaurant', 'location name'];
const ADDR_KEYS = ['address', 'addr', 'location', 'street', 'full address'];

/**
 * Turn pasted text into stops. Accepts a CSV with headers, "Name, Address"
 * lines, and bare addresses or place names — the three shapes a real list
 * arrives in.
 */
export function parseList(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const head = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
  const ni = head.findIndex((h) => NAME_KEYS.includes(h));
  const ai = head.findIndex((h) => ADDR_KEYS.includes(h));

  if (ni >= 0 || ai >= 0) {
    return lines.slice(1).map((l) => {
      const c = parseCSVLine(l);
      const name = ni >= 0 ? c[ni] || '' : '';
      const address = ai >= 0 ? c[ai] || '' : name;
      return { name: name || address, address: address || name };
    }).filter((s) => s.address);
  }

  return lines.map((line) => {
    const cells = parseCSVLine(line);
    // A line beginning with a house number is an address, not a name.
    if (/^\d/.test(line)) return { name: '', address: line };
    if (cells.length > 1 && /^\d/.test(cells[1])) {
      return { name: cells[0], address: cells.slice(1).join(', ') };
    }
    return { name: line, address: line };
  }).filter((s) => s.address);
}

export class Tray {
  constructor({ store, els, onChange, onFocusStop, onHoverStop, onPlaceStop, toast }) {
    this.store = store;
    this.els = els;
    this.onChange = onChange;
    this.onFocusStop = onFocusStop;
    this.onPlaceStop = onPlaceStop;
    this.onHoverStop = onHoverStop;
    this.toast = toast;
    this.hits = [];
    this.cursor = -1;
    this.searchAbort = null;
    this.mapCenter = null;
    this._wire();
  }

  _wire() {
    const { searchInput, searchResults, btnPaste, pasteSheet, pasteBox, trayList } = this.els;

    let t = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      this.searchAbort?.abort();
      this._renderHits([]);
      const q = searchInput.value.trim();
      if (q.length < 3) { this._renderHits([]); return; }
      t = setTimeout(() => this._search(q), 320);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { clearTimeout(t); this.searchAbort?.abort(); this._renderHits([]); searchInput.blur(); }
      if (['ArrowDown', 'ArrowUp'].includes(e.key) && this.hits.length) {
        e.preventDefault();
        this.cursor = (this.cursor + (e.key === 'ArrowDown' ? 1 : -1) + this.hits.length) % this.hits.length;
        [...searchResults.children].forEach((b, i) => {
          b.classList.toggle('is-highlighted', i === this.cursor);
          if (i === this.cursor) b.scrollIntoView({ block: 'nearest' });
        });
      }
      if (e.key === 'Enter' && this.hits.length) { e.preventDefault(); this._take(this.hits[Math.max(0, this.cursor)]); }
    });
    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== searchInput) this._renderHits([]);
    });

    btnPaste.addEventListener('click', () => { pasteBox.value = ''; pasteSheet.showModal(); });
    pasteSheet.addEventListener('close', () => {
      if (pasteSheet.returnValue !== 'ok') return;
      const rows = parseList(pasteBox.value);
      if (!rows.length) { this.toast('Nothing recognisable in that paste.', 'warn'); return; }
      this.store.batch(() => {
        for (const r of rows) this.store.add({ name: r.name || r.address, address: r.address }, { checkpoint: false });
      });
      this.toast(`${rows.length} stop${rows.length > 1 ? 's' : ''} added. Finding addresses…`);
      this._geocodePending();
    });

    trayList.addEventListener('mouseover', (e) => {
      const row = e.target.closest('[data-id]');
      this.onHoverStop?.(row ? row.dataset.id : null);
    });
    trayList.addEventListener('mouseleave', () => this.onHoverStop?.(null));

    trayList.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { this.store.remove(del.dataset.del); return; }
      const place = e.target.closest('[data-place]');
      if (place) { this.onPlaceStop?.(place.dataset.place); return; }
      const row = e.target.closest('[data-id]');
      if (row) this.onFocusStop?.(row.dataset.id);
    });
  }

  setMapCenter(c) { this.mapCenter = c; }

  async _search(q) {
    this.searchAbort?.abort();
    this.searchAbort = new AbortController();
    const signal = this.searchAbort.signal;
    this._searchMessage('Searching…');
    try {
      const hits = await geo.search(q, { near: this.mapCenter, signal });
      if (signal.aborted || this.els.searchInput.value.trim() !== q) return;
      this._renderHits(hits);
      if (!hits.length) this._searchMessage('No results. Try a city or street address, or use Add manually.');
    } catch { /* superseded by a newer keystroke */ }
  }

  _searchMessage(text) {
    const p = document.createElement('p');
    p.className = 'search-message';
    p.setAttribute('role', 'status');
    p.textContent = text;
    this.els.searchResults.replaceChildren(p);
    this.els.searchResults.hidden = false;
  }

  _renderHits(hits) {
    this.hits = hits;
    this.cursor = -1;
    const box = this.els.searchResults;
    box.textContent = '';
    if (!hits.length) { box.hidden = true; return; }
    for (const h of hits) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-hit';
      const b = document.createElement('b'); b.textContent = h.name;
      const s = document.createElement('span'); s.textContent = h.label || '';
      btn.append(b, s);
      btn.addEventListener('click', () => this._take(h));
      box.appendChild(btn);
    }
    box.hidden = false;
  }

  _take(hit) {
    this.store.add({
      name: hit.name, address: hit.label ? `${hit.name}, ${hit.label}` : hit.name,
      lat: hit.lat, lng: hit.lng, geoStatus: 'ok',
    });
    this.els.searchInput.value = '';
    this._renderHits([]);
    this.toast(`${hit.name} added.`, 'ok');
  }

  /** Resolve every stop still missing coordinates, one at a time. */
  async _geocodePending() {
    const pending = this.store.stops.filter((s) => s.geoStatus === 'none' && s.address);
    if (!pending.length) return;
    let found = 0;
    for (const s of pending) {
      const address = s.address;
      const hit = await geo.resolve(address);
      if (this.store.byId(s.id)?.address !== address) continue;
      if (hit) {
        found++;
        this.store.update(s.id, { lat: hit.lat, lng: hit.lng, geoStatus: 'ok' }, { checkpoint: false, silent: true });
      } else {
        this.store.update(s.id, { geoStatus: 'fail' }, { checkpoint: false, silent: true });
      }
      this.store.commit({ geocoding: true });
    }
    const missed = pending.length - found;
    if (missed > 0) this.toast(`${found} located, ${missed} could not be found — open them to fix the address.`, 'warn');
    else if (found) this.toast(`${found} stop${found > 1 ? 's' : ''} located.`, 'ok');
  }

  geocodePending() { return this._geocodePending(); }

  render() {
    const list = this.els.trayList;
    const sidings = this.store.sidings();
    this.els.trayCount.textContent = String(sidings.length);
    list.textContent = '';

    if (!sidings.length) {
      const p = document.createElement('p');
      p.className = 'tray-empty';
      p.textContent = 'Search or paste places to save for later. Use + to fit one into your day, or open it to choose a time.';
      list.appendChild(p);
      return;
    }

    for (const s of sidings) {
      const row = document.createElement('div');
      row.className = 'siding' + (s.geoStatus === 'ok' ? ' is-geo' : '') + (s.geoStatus === 'fail' ? ' is-nogeo' : '');
      row.dataset.id = s.id;
      row.setAttribute('data-event', JSON.stringify({ title: s.name || s.address, extendedProps: { stopId: s.id }, duration: { minutes: s.dwell || 30 } }));

      const tick = document.createElement('div'); tick.className = 'siding-tick';
      const mid = document.createElement('button'); mid.type = 'button'; mid.className = 'siding-edit';
      mid.setAttribute('aria-label', `Edit ${s.name || s.address}`);
      const nm = document.createElement('div'); nm.className = 'siding-name'; nm.textContent = s.name || s.address; nm.title = s.name || s.address;
      const ad = document.createElement('div'); ad.className = 'siding-addr';
      ad.textContent = s.geoStatus === 'fail' ? 'Not found — click to edit' : (s.address || '');
      ad.title = ad.textContent;
      mid.append(nm, ad);
      // The schedule already knows how much idle time the day has, and the tray
      // already knows what is waiting for it — the two never met, so "78 min
      // free" sat beside stops that would fit with no way to say so except a
      // drag. This is that path, and being a button it also works from the
      // keyboard, which dragging never did.
      const add = document.createElement('button');
      add.className = 'siding-add'; add.type = 'button'; add.dataset.place = s.id;
      add.setAttribute('aria-label', `Schedule ${s.name || s.address} in the first free gap`);
      add.title = 'Schedule in the first gap it fits';
      add.innerHTML = '';
      const ico = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ico.setAttribute('viewBox', '0 0 16 16'); ico.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M8 3.5v9M3.5 8h9');
      path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-linecap', 'round'); path.setAttribute('fill', 'none');
      ico.appendChild(path); add.appendChild(ico);

      const x = document.createElement('button');
      x.className = 'siding-x'; x.type = 'button'; x.dataset.del = s.id;
      x.setAttribute('aria-label', `Remove ${s.name || s.address}`); x.textContent = '×';

      row.append(tick, mid, add, x);
      list.appendChild(row);
    }
  }
}
