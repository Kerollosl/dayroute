# dayroute — Development Rules

## Running

```bash
python3 -m http.server 8754      # http://localhost:8754
```
Plain ES modules, no bundler. Use `?v=N` cache-busters while iterating.

## Architecture

| File | Owns |
|---|---|
| `store.js` | State, `localStorage`, undo stack, time/format helpers |
| `geocode.js` | Photon → Nominatim, one serial queue, permanent cache |
| `route.js` | OSRM matrix, the constrained optimiser, sequence maths |
| `gmaps.js` | Maps URL building, leg chunking, clipboard |
| `map.js` | MapLibre, style recolouring, markers, route line |
| `schedule.js` | FullCalendar + the Line SVG overlay |
| `stops.js` | Sidings tray, list parsing, place search |
| `app.js` | Wiring; the single `store.change` → recompute path |

## Rules that are load-bearing

**Never set `position` on `info.el` or `.fc-v-event`.** FullCalendar sizes events
with absolute `top`/`bottom` so they stay proportional to duration; overriding it
makes them grow to fit their text instead. The Line overlay only ever *reads*
geometry (`getBoundingClientRect`) and writes nothing back. Inherited from
`gcal-plus`, where this cost real debugging time.

**The matrix cache key must stay order-independent** (`canonical()` in `route.js`).
Keying it on sequence would make every drag refetch — the exact thing the design
promises never happens. `hasMatrix()` exists to assert this in tests.

**Never resolve a matrix index by position in the sequence.** `MI()` in `route.js`
must go through `stop.mi` or `matrix.mi(stop)`. The matrix rows are in canonical
*coordinate* order (see `canonical()`), not sequence order, so falling back to the
loop index silently reads the wrong cell and returns a plausible wrong distance
rather than throwing. This shipped once as `stops[i].mi ?? i` and made an optimiser
test report "no improvement" on a day that improved by 43 minutes.

**`[hidden] { display: none !important; }` in `style.css` is required.** Any
`display` rule outranks the UA stylesheet's `[hidden]`, so `.delta { display:flex }`
silently defeats `el.hidden = true`.

**Colour parsing needs two sentinels** (`parseColor` in `map.js`). An invalid colour
leaves `ctx.fillStyle` unchanged, so a single default makes `"interpolate"` parse as
black and flattens every MapLibre expression into a colour.

**Never `innerHTML` a stop name.** Names come from pasted lists and geocoder
responses. `toast()` and every renderer use `textContent`.

**A token rename that crosses a light/dark boundary is not mechanical.** `sed`
cannot tell "text on paper" from "text on a saturated fill". Renaming
`--porcelain` to `--ink-strong` across the sheet silently inverted white text
into near-black *everywhere it sat on a colour fill* — `.btn--line` hover and
`::selection` shipped at 3.32:1 against the product's own 4.5:1 floor, while
`.btn--primary` survived only because it happened to use a different token.
After any palette rename, grep every `background: var(--<saturated>)` rule and
re-check the `color` beside it. The current palette removes the trap at the
source: `--accent` is legal in both directions, so there is no text/fill pair to
cross.

**A `Draggable` with `eventData` needs `eventReceive` to discard FC's copy.**
FullCalendar mints its own event for an external drop whenever the Draggable
supplies `eventData`. `drop:` already writes the stop to the store, which
re-renders it — so the stop existed twice, FC treated the pair as concurrent
events, and laid them side by side at half width. The store is the single
source of truth; `eventReceive: (info) => info.event.remove()` throws FC's
duplicate away. Symptom to recognise: a dragged-in stop appears as two
half-width events, and `.fc-v-event` count exceeds the scheduled-stop count.

**The optimiser's day starts at the day's first stop, not at 08:00.**
`optimize()` and `plan()` default `dayStart` to `DAY_START_MIN`, which dragged a
10am-to-4pm day back two hours purely because the window allowed it. `app.js`'s
`dayWindow()` derives the start from the earliest scheduled stop and must be
passed to `optimize` **and** to both `plan` calls — `before` and `after` have to
share a window or the savings figure is meaningless. `dayEnd` stays fixed;
without an end bound the tail gap is infinite and nothing is ever unfit.

**The origin is `origin: true`, not just `pinned: true`.** The day's starting
point is a departure, not an appointment. `simulate` resets the clock to a
pinned stop's `startMin`, so modelling the origin as merely pinned pinned the
DEPARTURE to the first stop's own time — every arrival slid later by the
inbound leg, and a fixed first appointment became unreachable ("Can't reach X
in time") purely because an origin existed. `simulate` now records the origin's
time and moves on with no dwell and no clock reset; `optimize` holds it at
index 0 via `lo`, which is the first position anything else may occupy.

**`dayWindow` only departs early for a FIXED appointment.** Leaving before the
first scheduled stop is justified only when a pinned stop cannot otherwise be
reached; a flexible stop simply shifts to whenever you arrive. Leading against
the earliest *scheduled* stop instead made an all-flexible day start at 08:21
for a 09:00 board, which is the same "don't drag my day earlier" complaint in
a new costume.

**`s.dwell || 30` reads an explicit 0 as missing.** `withIndex` applied that
plus a 5-minute floor to the origin, which spent a phantom half hour parked at
the starting point before the day began. The floor exists so a real stop has
visible height on the grid; the origin is never drawn and keeps its true 0.

**Never drag by hardcoded pixels in a test.** `expandRows` stretches slot height
to fill the pane, so the same pixel offset is a different number of minutes
depending on the day's length and the window size — a 2-stop day renders ~85px
per half-hour where the stylesheet says 38px. Measure px-per-minute off
`.fc-timegrid-slot-lane[data-time]` at runtime and drag in minutes. A
miscalibrated offset makes working behaviour look regressed, which cost a real
debugging pass here.

**A detector `ignore-value` only works for rules with an extractable value.**
`cream-palette` is not in `extractFindingIgnoreValue`'s `directValueRules`, so a
value-scoped ignore against it is a silent no-op that sits in config doing
nothing while the finding keeps firing. Scope a wildcard to a file instead
(`ignore-value <rule> "*" --file <glob>`), and always re-run the detector to
confirm the count actually dropped.

## Optimiser contract

`optimize(stops, matrix)` — stops carry `{lat,lng,dwell,pinned,startMin,mi}` where
`mi` is the canonical matrix index. Pinned stops keep their clock time and their
relative order. Returns `{order, unfit}`; `unfit` stops had no feasible position and
must be surfaced, never dropped. `plan()` walks the order on the clock and reports
`feasible`, `endMin`, per-leg figures, and `estimated` when the matrix is a
straight-line fallback.

Day window is 08:00–20:00 (`DAY_START_MIN`, `DAY_END_MIN`). Without the end bound
nothing is ever unfit, because the tail gap is infinite.

## Testing

`node --check` each module for syntax. The optimiser is pure and testable in Node
(no DOM, no `localStorage`) — import `route.js` directly and assert on real OSRM
matrices. Browser checks run through Playwright with
`--enable-unsafe-swiftshader` (MapLibre needs WebGL; headless has none by default).
