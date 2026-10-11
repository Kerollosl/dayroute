import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const realTimeout = globalThis.setTimeout;
let serial = 0;
const fresh = (name) => import(`../${name}.js?test=${++serial}`);
const points = [{ lat: 38.9, lng: -77.1 }, { lat: 39.1, lng: -77.3 }];
const json = (body) => ({ ok: true, json: async () => body });
const road = () => json({ code: 'Ok', durations: [[0, 600], [900, 0]], distances: [[0, 4000], [6000, 0]] });

beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  // All network calls are mocked. Skip courtesy delays and exercise deadlines quickly.
  globalThis.setTimeout = (fn, ms, ...args) => realTimeout(fn, ms >= 8000 ? 15 : 0, ...args);
});
afterEach(() => { globalThis.fetch = realFetch; globalThis.setTimeout = realTimeout; });

test('unreachable road cells become labeled estimates, never free travel', async () => {
  globalThis.fetch = async () => json({ code: 'Ok', durations: [[0, null], [null, 0]], distances: [[0, null], [null, 0]] });
  const r = await fresh('route');
  const m = await r.fetchMatrix(points);
  assert.equal(m.estimated, true);
  assert.ok(m.durations[0][1] > 0);
  assert.ok(m.distances[0][1] > 0);
});

test('same canonical matrix shares one in-flight request and correct indices', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return road(); };
  const r = await fresh('route');
  const [a, b, c] = await Promise.all([r.fetchMatrix(points), r.fetchMatrix([...points].reverse()), r.fetchMatrix(points)]);
  assert.equal(calls, 1);
  assert.equal(a, b); assert.equal(a, c);
  assert.notEqual(a.mi(points[0]), a.mi(points[1]));
  assert.equal(a.mi({ lat: 0, lng: 0 }), undefined);
  assert.equal(r.hasMatrix([...points].reverse()), true);
});

test('routing retry replaces an estimated cache entry after recovery', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  const r = await fresh('route');
  assert.equal((await r.fetchMatrix(points)).estimated, true);
  globalThis.fetch = async () => road();
  assert.equal((await r.fetchMatrix(points, { refresh: true })).estimated, false);
});

test('stalled routing releases the queue with a marked fallback', async () => {
  globalThis.fetch = async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  const r = await fresh('route');
  assert.equal((await r.fetchMatrix(points)).estimated, true);
  globalThis.fetch = async () => road();
  assert.equal((await r.fetchMatrix(points, { refresh: true })).estimated, false);
});

test('optimizer preserves origin and fixed clocks while reporting unfit stops', async () => {
  const r = await fresh('route');
  const m = { durations: [[0,600,600],[600,0,600],[600,600,0]], distances: [[0,1000,1000],[1000,0,1000],[1000,1000,0]] };
  const stops = [
    { id:'origin', origin:true, pinned:true, mi:0, startMin:540, dwell:0 },
    { id:'fixed', pinned:true, mi:1, startMin:550, dwell:30 },
    { id:'unfit', pinned:false, mi:2, startMin:560, dwell:700 },
  ];
  const { order, unfit } = r.optimize(stops, m, { dayStart:540 });
  assert.deepEqual(order, [0,1]); assert.deepEqual(unfit, [2]);
  const actual = r.plan(order, stops, m, { dayStart:540 });
  assert.deepEqual(actual.times, [540,550]);
  const comparison = r.comparisonOrder(order, unfit, stops, m);
  assert.equal(comparison[0], 0);
  assert.equal(new Set(comparison).size, 3);
});

test('unknown matrix indices are rejected, not confused with the first stop', async () => {
  const r = await fresh('route');
  assert.throws(() => r.plan([0,1], [{ dwell:30 }, { dwell:30 }], { durations:[[0]], distances:[[0]] }), /matrix index/);
});

test('late scheduled stops extend the day without hiding a truly late arrival', async () => {
  const r = await fresh('route');
  const stops = [
    { id:'first', pinned:true, mi:0, startMin:19*60+10, dwell:45 },
    { id:'late', pinned:true, mi:1, startMin:23*60, dwell:30 },
  ];
  const dayEnd = r.scheduledDayEnd(stops);
  assert.equal(dayEnd, 23*60+30);

  const feasible = { durations:[[0,9*60],[9*60,0]], distances:[[0,1000],[1000,0]] };
  const onTime = r.plan([0,1], stops, feasible, { dayStart:19*60+10, dayEnd });
  assert.equal(onTime.feasible, true);
  assert.equal(onTime.lateId, null);

  const impossible = { durations:[[0,200*60],[200*60,0]], distances:[[0,1000],[1000,0]] };
  const arrivesLate = r.plan([0,1], stops, impossible, { dayStart:19*60+10, dayEnd });
  assert.equal(arrivesLate.feasible, false);
  assert.equal(arrivesLate.lateId, 'late');
});

test('the first inbound drive starts before the first card and preserves built-in gaps', async () => {
  const r = await fresh('route');
  const stops = [
    { id:'origin', origin:true, pinned:true, mi:0, startMin:19*60+30, dwell:0 },
    { id:'first', pinned:false, mi:1, startMin:19*60+30, dwell:45 },
    { id:'second', pinned:false, mi:2, startMin:20*60+24, dwell:30 },
  ];
  const m = {
    durations:[[0,5*60,14*60],[5*60,0,9*60],[14*60,9*60,0]],
    distances:[[0,1000,2000],[1000,0,1000],[2000,1000,0]],
  };
  const dayStart = r.scheduledDayStart(stops, m);
  const dayEnd = r.scheduledDayEnd(stops.filter((s) => !s.origin));
  assert.equal(dayStart, 19*60+25);
  assert.equal(dayEnd, 20*60+54);

  const onTime = r.plan([0,1,2], stops, m, { dayStart, dayEnd });
  assert.equal(onTime.feasible, true);
  assert.deepEqual(onTime.times, [19*60+25, 19*60+30, 20*60+24]);
  assert.equal(onTime.lateId, null);

  const oldClock = r.plan([0,1,2], stops, m, { dayStart:19*60+30, dayEnd });
  assert.equal(oldClock.feasible, false);
  assert.equal(oldClock.lateId, 'second');
});

test('nested fixed appointments all show an overlap', async () => {
  const { Store } = await fresh('store');
  const s = new Store();
  for (const [id, start, dwell] of [['A','09:00',180],['B','09:30',15],['C','10:00',15],['D','12:00',15]]) {
    s.add({ id, start, dwell, pinned:true, day:s.day });
  }
  assert.deepEqual([...s.pinnedOverlaps()].sort(), ['A','B','C']);
});

test('storage failure is exposed and Undo still works in the session', async () => {
  const { Store } = await fresh('store');
  const s = new Store();
  globalThis.localStorage.setItem = () => { throw new Error('quota'); };
  s.add({ name:'Errand' });
  assert.equal(s.saveFailed, true);
  assert.equal(s.undo(), true); assert.equal(s.stops.length, 0);
});

test('move to now shifts scheduled stops together and keeps one undo step', async () => {
  const { Store, nextQuarterHour } = await fresh('store');
  const s = new Store();
  assert.equal(nextQuarterHour(new Date(2026, 8, 11, 10, 7)), 615);
  assert.equal(nextQuarterHour(new Date(2026, 8, 11, 10, 15, 1)), 630);
  s.add({ id: 'first', day: s.day, start: '09:00', dwell: 30 });
  s.add({ id: 'second', day: s.day, start: '10:10', dwell: 45 });

  const result = s.shiftScheduled(s.day, 75);
  assert.deepEqual(result, { count: 2, applied: 75, clamped: false });
  assert.equal(s.byId('first').start, '10:15');
  assert.equal(s.byId('second').start, '11:25');
  assert.equal(s.undo(), true);
  assert.equal(s.byId('first').start, '09:00');
  assert.equal(s.byId('second').start, '10:10');
});

test('move to now clamps a late-day shift before midnight', async () => {
  const { Store } = await fresh('store');
  const s = new Store();
  s.add({ id: 'late', day: s.day, start: '23:00', dwell: 30 });
  const result = s.shiftScheduled(s.day, 120);
  assert.equal(result.applied, 30);
  assert.equal(result.clamped, true);
  assert.equal(s.byId('late').start, '23:30');
});

test('failed geocoding is retryable and successful results are cached', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  const geo = await fresh('geocode');
  assert.equal(await geo.resolve('Test library'), null);
  const failedCalls = calls;
  globalThis.fetch = async () => { calls++; return json({ features:[{ geometry:{ coordinates:[-77.1,38.9] }, properties:{ name:'Test library' } }] }); };
  assert.equal((await geo.resolve('Test library')).lat, 38.9);
  assert.ok(calls > failedCalls);
  const successCalls = calls;
  await geo.resolve('Test library');
  assert.equal(calls, successCalls);
});

test('old persisted null geocoding misses do not prevent recovery', async () => {
  localStorage.setItem('dayroute.geocache.v1', JSON.stringify({ 'test library':null }));
  globalThis.fetch = async () => json({ features:[{ geometry:{ coordinates:[-77.1,38.9] }, properties:{ name:'Test library' } }] });
  const geo = await fresh('geocode');
  assert.ok(await geo.resolve('Test library'));
});

test('cancelled typeahead never consumes a provider request', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({ features:[] }); };
  const geo = await fresh('geocode');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(geo.search('Test library', { signal:controller.signal }), { name:'AbortError' });
  assert.equal(calls, 0);
});

test('phone-safe Maps legs include every stop with shared endpoints', async () => {
  const g = await fresh('gmaps');
  for (const count of [2,5,6,8,11,20]) {
    const stops = Array.from({ length:count }, (_, i) => ({ name:`Stop ${i}`, lat:38+i/100, lng:-77 }));
    const legs = g.buildLinks(stops);
    const reconstructed = [];
    for (const [i, leg] of legs.entries()) {
      const q = new URL(leg.url).searchParams;
      const mid = q.get('waypoints')?.split('|') || [];
      assert.ok(mid.length <= 3);
      const sequence = [q.get('origin'), ...mid, q.get('destination')];
      if (i) assert.equal(sequence[0], reconstructed.at(-1));
      reconstructed.push(...sequence.slice(i ? 1 : 0));
    }
    assert.deepEqual(reconstructed, stops.map((s) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`));
  }
});

test('one stop hands off as a destination without inventing an origin', async () => {
  const g = await fresh('gmaps');
  const links = g.buildLinks([{ name:'Library', ...points[0] }]);
  assert.equal(links.length, 1);
  const q = new URL(links[0].url).searchParams;
  assert.equal(q.has('origin'), false); assert.ok(q.get('destination'));
  assert.deepEqual(g.buildLinks([]), []);
});



test('portable export roundtrip and malformed import retain original state', async () => {
 const {Store}=await fresh('store');
 const a=new Store(); a.add({name:'Backup stop',address:'123 Example St'});
 const text=a.exportJSON(); const b=new Store(); b.importJSON(text);
 assert.equal(b.stops[0].name,'Backup stop');
 const before=b.exportJSON(); assert.throws(()=>b.importJSON('{broken'));
 assert.equal(b.exportJSON(),before);
});


test('valid JSON with invalid saved schema is retained for recovery', async () => {
 const raw='{"stops":"corrupted"}';localStorage.setItem('dayroute.v1',raw);
 const {Store}=await fresh('store');const s=new Store();
 assert.equal(s.exportJSON(),raw);assert.ok(s.loadError);
 s.add({name:'Temporary'});assert.equal(localStorage.getItem('dayroute.v1'),raw);
});
