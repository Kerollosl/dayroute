# dayroute — Design System

**World: Native.** Built to the conventions iOS and Material already share, because
this is a tool someone opens on a phone in a car: the system typeface, a neutral
near-white ground with true-white surfaces, hairline separators instead of walls,
one accent that means one thing, and sentence case everywhere.

This replaced a world called *Paper Line* (warm oat ground, terracotta complement,
Archivo webfont, letterspaced caps, radius 0, decorative hatch fills). That palette
is one of the most recognisable generated-interface signatures, and it read as such.
Nothing from it survives. Do not reintroduce warm grounds, a second decorative
colour, uppercase labels, or background texture.

---

## Palette

Neutral surfaces; the map and the single green carry all the colour.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F5F5F7` | app ground |
| `--surface` | `#FFFFFF` | every content surface: cards, panes, sheets |
| `--hover` / `--pressed` | `#F0F0F3` / `#E8E8EC` | interaction states |
| `--sep` | `rgba(0,0,0,.10)` | hairline separator |
| `--sep-soft` | `rgba(0,0,0,.06)` | grid rules inside the schedule |
| `--sep-strong` | `rgba(0,0,0,.16)` | input borders |
| `--text` | `#1D1D1F` | headings, figures, fixed-stop marks |
| `--text-2` | `#4A4A4F` | secondary UI text |
| `--text-3` | `#6E6E73` | meta, addresses, axis labels |
| `--accent` | `#0B7A4B` | the route, the primary action, a flexible stop |
| `--accent-hover` | `#096540` | pressed/hover of an accent fill |
| `--accent-wash/tint/edge` | `rgba(11,122,75,.09/.16/.32)` | tonal fills |
| `--danger` | `#D93025` | **faults only** |

Separators are ink at low alpha, never a grey paint, so one token sits correctly on
both the grey ground and a white card.

### Measured contrast

| Pair | Ratio |
|---|---|
| `--text` on white / on ground | 16.83 / 15.46 |
| `--text-2` on white / on ground | 8.81 / 8.09 |
| `--text-3` on white / on ground | 5.07 / 4.66 |
| `--accent` on white / on ground | 5.39 / 4.95 |
| white on `--accent` | 5.39 |
| white on `--accent-hover` | 7.13 |
| `--danger` on white | 4.77 |

Every text token clears 4.5:1 on both surfaces. `--text-3` is the floor, not a soft
grey — do not go lighter for "subtlety".

### The table models flat grounds only — check tinted fills separately

Every ratio above is measured on white or on `--bg`. Those are the only two flat
grounds; the UI also paints text on *tonal* fills, which this table never
covered, and three of them shipped under the floor:

| Pair | Was | Now |
|---|---|---|
| `--accent` on `--accent-wash` (`.btn--tonal`) | **4.38** | 5.80 |
| `--accent` on the day-nav control (`.daynav-today`) | **4.43** | 5.86 |
| `--text-3` on the count pill (`.pane-count`) | **4.08** | 7.09 |

**Accent text on any accent fill uses `--accent-hover`, never `--accent`.** This
is not a second green — `--accent-hover` already exists for pressed states, so
the One Accent Rule still holds. `--accent` stays correct on white and on
`--bg`; the moment it sits on a wash or tint it is out of budget. Likewise
`--text-3` is the floor *on flat ground* and drops below it on a tinted pill;
use `--text-2` there.

---

## Named rules

**The One Accent Rule.** `#0B7A4B` measures 5.39:1 against white *in both
directions*, so the same token is legal as a fill behind white text **and** as small
text on white. The previous palette needed a separate deepened sibling for text, and
shipped a 3.32:1 button the moment a rename crossed the two. One value removes that
entire class of bug. Do not add a second green.

**The Elevation-Not-Tone Rule.** A white card measures only **1.09:1** against the
grey ground — *lower* than the 1.12:1 step that was genuinely unreadable in the old
dark theme. It works here solely because separation is carried by `--shadow-1`, the
way both reference platforms resolve a white card on a grey sheet. Consequence: if
you ever remove a card's shadow, it disappears. Never separate a surface by tone
alone at this ratio, and never "flatten" a shadow away as cleanup.

**The Sentence Case Rule.** There are zero `text-transform: uppercase` rules in the
stylesheet, and no letterspacing on any label. Uppercase tracked micro-labels on
every element were the single loudest generated-interface tell in the old build.

**The System Face Rule.** No webfont is loaded — `index.html` has no Google Fonts
link. `var(--font)` resolves to the platform's own text. Shipping a display webfont
is itself a tell; matching the OS is most of why this reads as native.

**The One Radius Ramp Rule.** `--r-sm 6 / --r-md 9 / --r-lg 12 / --r-xl 16 /
--r-pill 980`, applied consistently — including inside the schedule, which
previously held radius 0 as a rule and read as unstyled rather than as a deliberate
diagram. No raw pixel radii.

**The Danger Reserve.** `--danger` appears only for a real fault: won't-fit,
collision, a failed address lookup, the delete action. It is never decoration and
never a second accent.

Two breaches shipped and are now fixed, both worth recognising by shape:

- **The now-indicator was `--danger`.** FullCalendar's current-time rule is not
  a fault, but it painted the only red on a healthy day — an unlabelled
  full-width line under the last stop, directly below a legend that had just
  taught the reader red means "Won't fit". It is `--text-2` now: strong enough
  to read against the grid's `--sep-soft` hairlines, and mute enough to claim
  nothing. Never spend red on a time reference.
- **`.rail-note` was `--danger-wash`.** The Maps waypoint ceiling is always
  true and never dismisses; styling a permanent fixture as an alert spends the
  reserve on furniture and leaves nothing louder for a real failure. It is a
  neutral card with a hairline — a footnote, which is what it is.

**A fault must be derived on every recompute, not only after Optimize.**
`unfitIds` is populated by `optimize()` alone, so a day built by hand into an
impossible shape — the normal way anyone discovers a conflict — showed the
legend's red mark on nothing at all and reported the problem as one line of
12px text in the rail footer, ~900px from the stop it named. `plan()` already
computes `feasible` and `lateId` on every pass; `app.js` folds `lateId` into
the marked set so the card, the badge and the map pin all carry it at once. The
badge distinguishes the two faults: Optimize *excludes* a stop ("Won't fit"),
an infeasible hand-built day still visits it ("Runs late").

**A fault badge replaces the "Fixed" badge, never stacks with it.** A conflict
or a late arrival only happens to a stop that is already fixed, so both badges
say the same thing twice — in a squeezed side-by-side column, which is exactly
the width that column has least of.

**No Texture.** Zero `data:image/svg+xml` background fills. Depth is shadow;
ground is flat colour.

**The Card Stripe Ban.** Event cards carry no coloured left edge. The track beside
them already colours state (accent = flexible, `--text` = fixed, `--danger` =
won't-fit) and the badge names it; a stripe repeated the same fact a third time and
tripped the `side-tab` detector honestly.

**The Coarse Pointer Rule.** Touch targets are sized under
`@media (pointer: coarse)`, not by viewport width — a narrow window on a laptop
is still a mouse, and a large tablet is still a thumb. Everything interactive
measures at least 40px there, and the destructive control (remove a stop) gets a
full 44px. Desktop sizes stay at 32-34px, which is correct for a cursor.

**The legend earns each mark independently.** "A key for marks that are not on
screen is noise" was applied all-or-nothing at zero stops, so a day of one
flexible errand still advertised "Fixed" and "Won't fit". `renderLegend()` now
takes the live state and filters per item.

**Idle time and the tray must connect.** The schedule computes and names its
own slack ("78 min free"); the tray holds what is waiting for it. Nothing
joined them, so the only way to act on a gap was a drag — which is also the one
interaction a keyboard cannot perform. Every unscheduled row carries a **+**
that schedules the stop into the first gap long enough to hold it. Gaps are
measured on the clock alone: subtracting drive time would need a matrix
containing a stop that is by definition not in the route yet, and Principle 3
forbids the drag loop waiting on the network. Placing optimistically is safe
only because an infeasible result now marks itself on every recompute — the
stop lands and says "Runs late" rather than lying.

**Naming a fault without offering a way out is half a design.** The conflict
badge is a *button*: it moves the stop to when the one it overlaps ends, plus
the drive between them when the cached matrix knows it. Without that travel
allowance the "fix" merely trades a collision for a "Runs late", which resolves
nothing the person can act on. Both stops in a collision are pinned, so which
one yields is a real decision — pressing a badge is how they say which.

**The primary action follows the device, not the state.** Copy-then-open is a
desktop flow: you copy a link to put it somewhere. On the phone there is
nowhere to paste it and the next action is always "open this in Maps", so under
`pointer: coarse` the button starts as **Open in Maps** and opens on first
press. Keyed on the pointer, like every other touch decision here.

**Empty states name the way in.** A bare ruled grid is a blank page. The
schedule's empty state states the two available actions (click a time, or drag
from Unscheduled) and keeps `pointer-events: none` so the click-a-time
affordance it describes still works through it. The legend hides when there are
no stops — a key for marks that are not on screen is noise. `Optimize` disables
below two routable stops rather than offering an action that provably cannot do
anything.

**The starting point is not a stop.** It has no grid slot, no sequence number,
no dwell, and never counts toward "Stops". On the map it is a bearing dot
(`.pin--start`), never a numbered badge, because it is not somewhere you go. In
the rail it is a settings row — current value plus a chevron — the shape both
platforms use for "this is the value, tap to change it".

**FullCalendar sizing.** Never set `position` on `.fc-v-event` / `info.el` — FC
sizes events by absolute top/bottom and overriding it makes them grow to fit text.
`LABEL_INSET` in `schedule.js` must equal `.fc-v-event`'s `margin-left` (30px).

**The card uses the height the grid already gave it.** `.ev-name` was
`white-space: nowrap` + ellipsis, so "Parent-teacher confer…" clipped sideways
inside a 100px card holding 70px of empty white — the card is sized by dwell, so
a long stop has room the name was forbidden to use. It clamps to two lines now,
one line under `@container ev (max-height: 62px)` where a second line would eat
the address. Use `overflow-wrap: break-word`, never `anywhere`: the latter broke
"Baltimore" as "Balti / m…" mid-word in a squeezed column.

**`.ev-top` must not shrink.** `.ev` is a flex column at `height: 100%`, so the
name row was shrinkable and collapsed to a single 19px line whenever the card
was shorter than its content — silently defeating the two-line clamp (measured
`scrollHeight` 38 inside a 19px box, with the clamp reporting 2). The row that
holds the name never yields; `.ev-meta` is the part that gives way.

**Every card states its own arrive–depart.** The grid position encodes it, but
reading it means tracking left to the axis and interpolating between half-hour
rules — on a phone, while scrolling. `.ev-when` is 12-hour to match the axis's
own voice, never truncates, and the address yields to it.

---

## Type

System stack (`--font`). Eight steps on the platform's own ramp, not a strict
modular one.

| Token | px | Role | Weight |
|---|---|---|---|
| `--fs-1` | 11 | badges, attribution | 590 |
| `--fs-2` | 12 | addresses, meta, captions, axis | 400–500 |
| `--fs-3` | 13 | body, buttons, inputs, list rows | 400–590 |
| `--fs-4` | 15 | stop names, section titles | 590–600 |
| `--fs-5` | 17 | dialog titles | 600 |
| `--fs-6` | 20 | wordmark | 600 |
| `--fs-7` | 26 | day totals | 600 |
| `--fs-8` | 32 | reserved lead figure | 600 |

Weights are 400 / 500 / 590 / 600. `590` is the SF-style semibold that reads as
emphasis without going blocky. Line-height roles: `--lh-tight 1.1` (figures),
`--lh-label 1.25` (single-line UI), `--lh-read 1.45` (prose). Negative tracking
scales with size (−.005em at UI sizes to −.028em on the day totals); nothing is
positively tracked.

All figures are `tabular-nums`, set globally on `body`.

---

## Space, elevation, motion

4px grid, `--space-1..7` (4/8/12/16/20/24/32).

Elevation is two real levels plus a modal level:
`--shadow-1` at rest (cards, events, buttons), `--shadow-2` on hover and for map
chrome, `--shadow-3` for dialogs, toasts and popovers. Depth is never a border.

Motion: `--t-fast 120ms` (state), `--t-base 220ms` (entry), `--t-move 420ms` (the
post-optimise travel), on `--ease cubic-bezier(.32,.72,0,1)`. Under
`prefers-reduced-motion` spatial travel and looping animation stop; opacity and
colour state changes stay.

---

## Layout

Three columns, `"rail line map"`.

- **Rail** (`clamp(248px, 20vw, 292px)`) — brand, day segmented control, the three
  totals, the two actions, then **Unscheduled**, which takes the whole remaining
  height, then status.
- **Schedule** (`clamp(340px, 30vw, 452px)`) — full column height.
- **Map** — the remainder.

**Why Unscheduled lives in the rail.** It previously sat *below* the schedule in the
same column. That halved the schedule — a ten-hour day could only show about four
hours at 1440×800 — and created two competing nested scroll regions inside one
narrow strip, which is what felt stuck. Moving it into the rail took the schedule
from 425px to 756px of usable height and dropped the unscheduled list's hidden
overflow from 112–145px to zero. Do not put a second scroll region back into the
schedule column.

Schedule slots are 38px per half-hour in CSS, but `expandRows` stretches rows to
fill the pane — a short day renders far taller slots than a long one. **Any test
that drags by pixels must measure `px per minute` off the live grid**
(`.fc-timegrid-slot-lane[data-time]`); hardcoded pixel offsets silently become a
different number of minutes when the pane height changes.

Below 900px the page owns the only scroll, and the order is the **drive
moment**, not the desktop reading order.

`rail / line / map` put the whole authoring apparatus first: measured, the
schedule began at exactly one full screen down (844px) and the map at ~2.5
screens on a 2507px page — the day itself below the fold on the device the day
is read on, which contradicts PRODUCT.md's own two-device story. The order is
now brand, day, totals, actions, then **schedule**, then **map**, and only then
the tools that change it (origin, Unscheduled, Paste a list). Measured after:
schedule at 316px, first stop at 564px, both inside the first viewport.

This is done with `display: contents` on `.rail` plus `order` — no DOM change,
and the desktop three-column layout is untouched. Two traps, both measured:

- `display: contents` removes the *box*, not the DOM node. The rail's children
  become grid items of `.app` while remaining DOM children of `.rail`, so
  `.app > .brand` matches nothing. Select them as `.rail > .brand`.
- `.line-pane` / `.map-pane` keep `grid-area: line|map` from the desktop rule.
  Once `grid-template-areas` is `none` those idents resolve as implicit *line*
  names and Chrome mints implicit columns — measured 3 tracks on a 390px
  viewport. Hand placement back with `grid-area: auto`.

---

## Map

The basemap is recoloured by luminance in `map.js`. Anchors are neutral: ground
`#F1F2F4`→`#DFE1E5`, roads resolving to white, one cool water `#C9DEEC`, label ink
`#3C4043`, halo white. They are deliberately *not* the page's own ground — the map
must read as its own surface beside a white panel.

`ROUTE_INK` (`#0B7A4B`) is `--accent` and belongs to the route alone.

Markers are a rounded pill on a stem, bottom-anchored so the stem tip sits on the
coordinate. Accent by default, `--text` when the stop is a fixed appointment,
`--danger` when it won't fit or collides. **The marker shadow is a sanctioned
exception** to elevation-by-token: a marker floats over arbitrary tile content and
needs to separate from an unknown background, which no tonal step can do.

Colour parsing needs two sentinels (`parseColor`): an invalid colour leaves
`ctx.fillStyle` unchanged, so a single default makes `"interpolate"` parse as black
and flattens every MapLibre expression into a colour.

---

## Keyboard

The schedule is operable without a pointer. `schedule.js` held no key handler at
all: an event could be focused and opened, never **moved** — drag was the only
way to change a stop's time, and the stop sheet had no start-time field, so the
exact time of a fixed appointment, this product's central claim, could not be
typed by anyone. Now:

- **↑ / ↓** nudge a focused stop by 15 minutes, **Shift** for 5. This writes
  through the store exactly as a drag does, so it inherits undo for free.
- The store re-render destroys the focused node, so `eventDidMount` restores
  focus to the same stop via `_refocusId`. Without it the first arrow key throws
  focus to `<body>` and the second does nothing.
- The stop sheet has an **Arrive at** field with minute precision. Enter a time
  to schedule on the selected day; clear it to keep the stop unscheduled.

The document's `<h1>` is the wordmark; headings previously started at `<h2>`.
MapLibre's zoom controls ship a `#0096FF` focus ring — the only non-accent focus
colour on the surface — and are overridden to `--accent`.

---

## Copy

Plain words, sentence case, US spelling. "Schedule", not "The Line". "Unscheduled",
not "Sidings". "Optimize", "Copy link", "Open in Maps", "Paste a list", "Time here".
No taglines in-app. Never `innerHTML` a stop name — names come from pasted lists and
geocoder responses; every renderer uses `textContent`.

## September 2026 usability refinement

The Native palette, typography and desktop three-pane composition remain intact.
The refinement changes access and feedback, not the visual identity:

- Phone screens use a sticky Schedule / Map / Places control. The schedule
  keeps its natural time-scaled page scroll; the map and saved places are one
  action away. The starting point stays above the route totals.
- Add stop is visible in the schedule header. The empty day has a compact,
  actionable invitation instead of a full screen of unused time slots.
- The date label is a native date input. New-stop forms are drafts, not saved
  events, until submission. Enter saves; Cancel and Escape do not change data.
- Long routes expose each phone-safe Maps leg as a separate, labeled link.
  Estimate and missing-address notices sit beside route actions, with an
  explicit Retry routing action after service failure.
- Search offers loading/no-results feedback and arrow-key selection. Saved
  places and map pins have keyboard-accessible editing controls.
- A hidden map defers camera fitting until visible. Async route results and
  optimization cannot overwrite a newer day or edit.

Verification: regression tests plus browser checks at 320, 390, 768, 1024 and
1440px. Mocked routing fixtures exercise fixed/unfit appointments, long-route
handoff and in-flight day changes; screenshots are test data, not a saved user day.
