---
name: dayroute
description: A day of driving read as a rail line, not a list — the schedule is the diagram.
colors:
  enamel: "#0B1230"
  enamel-raise: "#0E1838"
  enamel-sink: "#070C22"
  hairline: "#1E2C57"
  hairline-soft: "#16214333"
  porcelain: "#FFFFFF"
  ink: "#E8ECF6"
  ink-mid: "#9FAECC"
  ink-dim: "#7C8AAC"
  scarlet: "#E21D2D"
  scarlet-hover: "#C4121F"
  scarlet-lift: "#FF6B75"
  cobalt: "#1E5BFF"
  cobalt-ink: "#6E9BFF"
  amber: "#FFC20E"
  green: "#22B14C"
  green-lift: "#56D882"
  enamel-hover: "#12204A"
  connector: "#2A3A66"
typography:
  micro:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.14em"
  ui-text:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "normal"
  sub-head:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  compact-stat:
    fontFamily: "'Archivo Narrow', Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  wordmark:
    fontFamily: "'Archivo Narrow', Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.01em"
  secondary-lead:
    fontFamily: "'Archivo Narrow', Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  mobile-lead:
    fontFamily: "'Archivo Narrow', Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "33px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  primary-lead:
    fontFamily: "'Archivo Narrow', Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "39px"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  none: "0px"
  chrome: "5px"
spacing:
  hair: "1px"
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-7: "32px"
components:
  button-primary:
    backgroundColor: "{colors.scarlet}"
    textColor: "{colors.porcelain}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.scarlet-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-mid}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.cobalt-ink}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-line-ready:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.porcelain}"
  station-fixed:
    textColor: "{colors.porcelain}"
    typography: "{typography.micro}"
  station-flexible:
    textColor: "{colors.cobalt}"
    typography: "{typography.micro}"
  station-unfit:
    textColor: "{colors.amber}"
    typography: "{typography.micro}"
---

# Design System: dayroute — The Midnight Line

## Overview

**Creative North Star: "The Midnight Line"**

dayroute refuses the arrangement every trip planner ships — itinerary cards beside a map panel — because that arrangement hides the one fact the product exists to surface: where the driving costs you time. Instead the schedule *is* the diagram. A vertical time axis (The Line) places each stop at its real clock position, so the empty space between two stations is drawn to scale and IS the drive leg, not a caption about it. The whole system reads as a fired-enamel metropolitan transit map: one midnight-blue material lit by three saturated inks that carry state, everything else rendered in hairline navy and tabular figures.

This is a bolder-register world chosen from Impeccable's direction round (seed `3faa1e80`, catalog id `wayfinding-cartography-signage-midnight-transit-diagram`), built in Operate mode along a code-led path — there is no image-generation step in this harness, so no approved visual comp exists upstream of the CSS and JS themselves; the code *is* the design record. Even the favicon is a miniature Line: a scarlet route with two porcelain interchange dots on an enamel ground.

Confirmed rejections, all visible in the shipped code: no shadow anywhere except one load-bearing exception (a pinned map pin's concentric ring, built from `box-shadow` because MapLibre markers have no native double-ring), no gradient (the ground texture is an SVG hairline mesh, not a gradient), and no stock basemap tile set (OpenFreeMap's `dark` style is recoloured at load into the same enamel ramp the interface uses). Radius is no longer an absolute rejection: after the user reported the surface as "harshly square" and "stiff and boxy" three times running, a structured question resolved it into a considered split — see Shapes — rather than a reversal of the whole no-shadow/no-gradient/no-stock-tile stance, which stayed intact.

**Key Characteristics:**
- One material (fired enamel, four tonal steps — sink, ground, raise, hover), separated by hairlines, never by shadow.
- Exactly three state inks on the diagram (porcelain / cobalt / amber); amber doubles as the system's general attention ink in chrome (the map's now-line, advisories, the busy status dot) but narrows to won't-fit alone the instant it lands on a station or a pin. Green is confirmation-only chrome and never touches the Line or the map.
- Archivo Narrow for every number and every signage-style caps label; Archivo for reading text.
- All figures that count something are tabular and right-set: totals, sequence numbers, leg minutes.
- Depth is tonal (four enamel steps), not cast — flat by material, not flat by accident.
- Radius is split, not absolute: tool chrome rounds at `--radius-chrome` (5px, a deliberate, user-chosen reversal of the system's original zero-radius stance); the diagram itself stays exactly `0`, with circles as its only curve.
- The type scale is eight named roles (`micro`/`ui-text`/`sub-head`/`compact-stat`/`wordmark`/`secondary-lead`/`mobile-lead`/`primary-lead`, 11–39px on a ≈×1.2 progression), rebuilt wholesale — along with a real 4px spacing grid and three line-height roles — after the prior per-component values were confirmed by audit to not add up to a system.
- A station on the Line is a tick with a label beside it, not a card — the event shell is transparent and borderless at rest, and a hover/selection surface only appears behind the tick, connector, and label together, so they read as one object.
- Motion splits cleanly by role: ordinary state change runs on `--t-fast`/`--t-base` with the system's original ease; anything that travels — a reorder, a count-up, a route drawing itself on — runs on `--t-move`/`--ease-out`. The system permits exactly one ambient loop (the busy status dot); a second one was tried on the now-line and rejected.
- The basemap is not a stock tile: its colours are re-derived from the source style's own luminance into the interface's ramp.

## Colors

The palette is one fired-blue material lit by three saturated line inks, with a fourth colour (green) held out of the diagram entirely as confirmation chrome.

### Primary
- **Scarlet — Route Ink** (`#E21D2D`): the track through the Line, the primary button fill, the recolored basemap's route line, the brand mark. Hover deepens to **`#C4121F`** — a floor value, not a guess: it clears 6.14:1 contrast against white text, so the hover state never trades legibility for feedback.
- **Scarlet Lift** (`#FF6B75`): a lightened lift of scarlet, tokenized as `--scarlet-lift` and used for exactly one thing — error-toast text on the dark `enamel-raise` surface, where the full-strength route ink would read too dark.

### Secondary
- **Cobalt — Flexible Station** (`#1E5BFF`): the ring ink for an unpinned ("flexible") stop on the Line and its map pin; also the system's single `:focus-visible` outline colour and the border of the maps-handoff button (see Components → Maps Handoff). Cobalt is the system's "go" colour outside the state-ink context.
- **Cobalt Ink** (`#6E9BFF`): a lifted cobalt, tokenized as `--cobalt-ink` and used wherever cobalt sits as small text directly on the enamel ground rather than as a fill or a ring — the Day Nav's "Today" hover state and the maps-handoff button's label at rest. Raw `--cobalt` measures 3.49:1 there, under the 4.5:1 floor for text; `--cobalt-ink` exists so "go" text is legible without becoming a fourth blue.

### Tertiary
- **Amber — Attention Ink** (`#FFC20E`): the system's general "pay attention here" colour — FullCalendar's now-line, the rail-note advisory, the warn toast, the busy status dot, and the stop sheet's failed-geocode note all use it for exactly that reason. On a station or a map pin, though, it carries exactly one meaning: a stop the optimiser could not fit into the day (the Line's station ring, the map pin, the `Won't fit` badge, and the legend). It never marks a routine drive leg — the Line's own gap-tick labels stay neutral ink-dim/ink-mid regardless of how long the leg runs.
- **Green — Confirmation** (`#22B14C`): stays in chrome, never on the Line or the map. It is the ready-status dot and the "less driving" delta panel (`background: #22B14C14`, `border: #22B14C4D` at low alpha over the raised enamel).
- **Green Lift** (`#56D882`): the same lift treatment as scarlet's, tokenized as `--green-lift`, used only for ok-toast text.

### Neutral
- **Porcelain** (`#FFFFFF`): the brightest value in the system. Dual role — it is both the neutral extreme (lead totals, station names, brand name, button text on scarlet/cobalt fills) *and* the state ink for a fixed appointment ("interchange") on the Line and map. No other neutral carries state.
- **Ink** (`#E8ECF6`): default body text color.
- **Ink Mid** (`#9FAECC`): secondary text, ghost-button labels, hairline hover states, the neutral dot on a drive-leg tag.
- **Ink Dim** (`#7C8AAC`): the system's dimmest legible text — used for every 11px label (totals, badges, meta lines, status). It is specified, not guessed: it clears **5.05:1** against `--enamel-raise`, the system's floor for functional text at 11px.
- **Enamel** (`#0B1230`): the ground — page background, the Line's own body, `<meta name="theme-color">`.
- **Enamel Raise** (`#0E1838`): the "above" surface — station/event boxes, sheets, search-result dropdowns.
- **Enamel Hover** (`#12204A`): a fourth, brighter tonal step above `enamel-raise`, tokenized as `--enamel-hover` — the interaction fill for a hovered station card, a selected station card, and a hovered search result. The material ladder is now four steps, not three: sink < enamel < raise < hover. (A siding card in the tray still steps up from `enamel` to `enamel-raise` on hover, one rung lower on the same ladder — it never reaches `enamel-hover`.)
- **Enamel Sink** (`#070C22`): the "below" surface — the rail sidebar, the tray, the map's own background and loading scrim, the track's casing stroke.
- **Hairline** (`#1E2C57`) / **Hairline Soft** (`#16214333`): the only dividers in the system. Hairline Soft is reserved for FullCalendar's minor (non-hour) gridlines so the hour grid still reads as the primary structure.
- **Connector** (`#2A3A66`): a hairline-adjacent tone that exists only for one thing — the resting colour of the line joining a station's tick to its label on the Line (see The Line, under Components). It is close to `--hairline` but distinct from it; when a station is hovered or selected the connector switches to that station's own ink instead.

**Browser-native surfaces are themed too.** `::selection` sets cobalt background with porcelain text — the same pairing as an active map pin. Scrollbars are tokenised rather than left to the OS default: `scrollbar-color` and `::-webkit-scrollbar-thumb` use `--hairline` at rest, brightening to `--ink-dim` on hover, at a fixed 9px thickness.

### Named Rules
**The Three Inks Rule.** Exactly three colours carry state on the diagram itself: porcelain (fixed), cobalt (flexible), amber (won't-fit). No fourth state colour is introduced on the Line or a map pin.

**The Chrome-Only Green Rule.** Green never appears on the Line or the map. It is confirmation chrome exclusively — the ready-status dot and the saved-time delta.

**The Contrast-Floor Rule.** `--ink-dim` is `#7C8AAC` specifically because it clears 5.05:1 on `--enamel-raise` — the floor for the system's smallest functional text. The primary hover `#C4121F` is specified the same way, for 6.14:1 against white, and `--cobalt-ink` the same way again — raw `--cobalt` on the enamel ground measures 3.49:1, under the 4.5:1 text floor, so any small cobalt text reaches for the lifted variant instead.

**The Attention-Ink Rule.** Outside the diagram, amber is the system's general attention ink: the map's now-line (a static amber dot on the current-time line — a pulsing version was tried and rejected in the finish pass for competing with the Line's own focal moments), the rail-note advisory, the warn toast, the busy status dot, and the stop sheet's failed-geocode note (`.field-note[data-state="bad"]`) all reach for it to mean "look here." The instant amber lands on a station or a map pin, though, it narrows to exactly one meaning — won't-fit — and nothing else on the diagram is ever coloured amber for a routine reason. This is what keeps the Three Inks Rule true at the diagram level while amber stays useful everywhere else.

## Typography

**Display Font:** Archivo Narrow (weight 700) — every display figure and the brand wordmark.
**Body Font:** Archivo (weights 400/600/700) — everything else.
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo` — the paste-a-list textarea (13px, on-scale) and inline `<code>` (a relative `0.92em`, the system's one type value that sits outside the fixed scale on purpose, since it has to shrink or grow with whatever text surrounds it).

**Character:** one grotesque family doing two jobs. Archivo Narrow's condensed width carries every display figure and the brand wordmark; full-width Archivo carries labels and reading text. Every numeral that counts something is rendered tabular — `font-feature-settings: "tnum" 1, "cv05" 1` globally on `body`, reinforced with explicit `font-variant-numeric: tabular-nums` on the figures that matter most.

This is a rebuilt system, not the original one repaired. The prior scale was nine raw pixel values with consecutive ratios scattering from 1.048 to 1.357 — no real progression — plus font-weight that was only ever *explicitly* 600 or 700 (400 was always inherited, never stated) and six different ad-hoc line-heights crammed into just the 11–12px range. An independent audit confirmed exactly what the user meant by "fonts and font sizes and spacing doesn't make sense," and the type scale, the line-height roles, and the weight rule below replace that wholesale, not patch it.

### The Type Scale

Eight sizes, one progression (≈×1.2, rounded to whole pixels), each a named **role** — a future addition picks a role instead of eyeballing a number. Declared and commented at the top of `style.css`'s `:root`:

| Token | Size | Role | Where it lands |
|---|---|---|---|
| `--fs-1` | 11px | micro | Badges, meta/address lines, footnotes — the system's floor. Carries both the uppercase signage caps (brand-sub, day-nav "Today," totals labels, delta label, pane count, legend, status, form field labels, map attribution) and a set of plain reading-adjacent lines (rail-note, station meta, addresses, the field's confirm/error note) — the same size doing two jobs, the way it did before, but now the two jobs are told apart by weight and line-height (see below), not left ambiguous. |
| `--fs-2` | 13px | UI text | Buttons, inputs, names, sequence numbers — the most-shared step. Both interactive/identifying UI text (buttons, pane titles, the day-nav date, station and siding names, search-result names, sheet titles) and reading text (sheet help copy, form field values, the paste textarea, toast text) land here. |
| `--fs-3` | 16px | sub-head | Declared for dialog titles and tight-context brand — but its one actual consumer today is the tray's delete glyph (`×`), borrowed purely so a lone character reads clearly, not because a delete button is a sub-head. Dialog titles (`sheet-title`) and the pane heading (`pane-title`) are both set at `--fs-2` instead, one step down from what the role's own name promises. |
| `--fs-4` | 19px | compact stat | The optimisation delta figure and the day-nav's prev/next chevrons — a real figure and a navigation glyph sharing one size for no reason but coincidence. |
| `--fs-5` | 23px | wordmark | The brand name, and — coincidentally, as before — the mobile-breakpoint secondary total figure (miles/stops at ≤900px). |
| `--fs-6` | 27px | secondary lead | The desktop miles and stop-count totals beside the lead figure. |
| `--fs-7` | 33px | mobile lead | The driving-total lead figure at ≤900px. |
| `--fs-8` | 39px | primary lead | The driving-total lead figure on desktop — the single largest number in the system. |

One text size lives outside this table entirely: the Line's own drive-leg minute label is drawn at `9.5px` inline inside the SVG overlay (`schedule.js`), not declared in CSS, so it never shows up in a CSS-level audit of the scale.

### Weight

Three weights, each carrying real hierarchy rather than being scattered per-component: **400** for reading/meta text (search input values, sheet help copy, toasts, addresses, advisories — now stated explicitly in every rule that uses it, not left to inherit silently as it was before); **600** for interactive/UI text (buttons, station and siding names, search-result names); **700** for anything that leads — headings that are display figures or brand, all tabular figures, and state-asserting badges (`Won't fit`, `Fixed`).

Named exceptions — record these as deliberate, not as violations:
- **`.daynav-btn`** (the prev/next chevron) stays unweighted at 400 despite sitting at the `compact-stat` size. It's a navigation glyph, not data; forcing it to 700 would make a `‹`/`›` arrow compete with the figures around it for weight it doesn't need.
- **`.daynav-date`** stays 700 at `--fs-2`, one weight class above its size-mates, because it's the primary identifier inside the Day Nav control, not a secondary label riding along beside one.
- **`.pane-title`** and **`.sheet-title`** are semantic headings (`<h2>`/`<h3>`) that override the reset's default heading weight (700, set globally on `h2, h3`) down to 600. A chrome label being a heading element doesn't make it a display lead; 700 stays reserved for figures and brand, not for every `<h2>`/`<h3>` in the markup.

**Loaded but unused:** the Google Fonts request pulls Archivo weight 500 (`Archivo:wght@400;500;600;700`), but no rule in `style.css` sets `font-weight: 500` anywhere. It costs a slightly larger font payload and asserts nothing.

### Line Height

Three roles replace what were six ad-hoc values crammed into the 11–12px range alone: **`--lh-tight` (.95)** for the big hero figures (all four lead/secondary total figures); **`--lh-label` (1.1)** for short single-line UI text that structurally never wraps (badges, buttons, pills, status, form field labels); **`--lh-read` (1.5)** for anything that's actually prose — addresses, help text, advisories, the brand tagline — content that could wrap even where truncation currently clips it.

Two bare literals survive outside the three roles, both deliberate single-character exceptions: the paste textarea sets `line-height: 1.7` (more air than `--lh-read` gives a block of monospace text) and the siding delete glyph (`×`) sets `line-height: 1` (a single glyph, not a line of text, has no use for any of the three roles).

### Named Rules
**The Named-Role Scale Rule.** Every font size is one of the eight `--fs-` tokens, and every token is documented by role, not just by number. A new component reaches for a role — never a bare pixel value, and never a ninth size.

**The Weight Carries Hierarchy Rule.** 400/600/700 mean reading text / interactive text / a leading figure-or-brand-or-badge, consistently, everywhere except the three named exceptions above. A font-weight that doesn't fit one of those three meanings is a sign the text has drifted outside the system, not a new pattern to extend.

**The Three Line-Heights Rule.** `--lh-tight`/`--lh-label`/`--lh-read` are the complete set. The two bare-literal exceptions (the paste textarea's `1.7`, the delete glyph's `1`) are single-purpose optical fixes, not a fourth role to reach for elsewhere.

## Layout

Desktop is a single fixed 100dvh, three-column CSS grid — `rail` (`--rail-w: 248px`) / `line` (`--line-w: clamp(340px, 30vw, 440px)`) / `map` (`1fr`) — with the tray docked under the Line column via `grid-template-areas: "rail line map" / "rail tray map"`. `body { overflow: hidden }` means the page itself never scrolls; each pane (rail, Line, tray, map) owns its own internal scroll.

**Spacing is a real 4px grid now**, not the locally-set one-offs it used to be. `--space-1` through `--space-7` (4 / 8 / 12 / 16 / 20 / 24 / 32px) is the complete scale; `--pad` and `--gap` are semantic aliases onto it (`--pad: var(--space-5)` = 20px, panel padding; `--gap: var(--space-3)` = 12px, grid gaps like the totals row) rather than the standalone values they used to be — `--pad` in particular changed value in the process, from a bare 18px to the on-grid 20px. Every component padding, margin, and gap in the stylesheet was remapped onto this scale; a previous version of this document recorded "component-internal padding is set locally per component rather than drawn from a shared scale" as a settled decision — that decision is exactly what the user reacted to, and it no longer holds. A handful of sub-4px literals survive on purpose: 1–3px optical nudges (a badge's vertical padding, a baseline alignment, a border-adjacent offset) that aren't "spacing between things" in the rhythm sense the grid governs, and forcing them onto a 4px step would either do nothing or visibly worsen the alignment they're tuned for.

**Responsive breakpoints:**
- **≤1180px** — the rail and Line columns narrow (`--rail-w: 216px`, `--line-w: clamp(300px, 30vw, 380px)`); the grid shape is unchanged.
- **≤900px** — the grid collapses to one column and re-stacks as `rail → line → map → tray` (`grid-template-rows: auto auto 42dvh auto`), `body { overflow: auto }` re-enables page scroll, and every pane's `border-right` divider rotates to `border-bottom`. Totals switch from a stacked column to a 3-cell grid (`total-row { display: contents }`), the lead figure drops from `--fs-8` to `--fs-7` (39px→33px) and the secondary figure from `--fs-6` to `--fs-5` (27px→23px), the rail's two action rows go horizontal, and the map is given an explicit `min-height: 260px` since it is no longer sized by `1fr` inside a fixed-height grid.

### Named Rules
**The 4px-Grid Rule.** Every meaningful gap, padding, and margin in the system is one of the seven `--space-` steps (or the `--pad`/`--gap` aliases onto them). A sub-4px bare literal is reserved for optical nudges that aren't rhythm — not an escape hatch for a value that doesn't fit the grid.

**The One-Screen Rule.** Desktop never scrolls the page. A 100dvh grid with `overflow: hidden` on `body` keeps the whole day composed on one screen; only the panes scroll internally.

**The Read-Only Overlay Rule.** The Line's SVG track is absolutely positioned over FullCalendar's real grid and only ever reads geometry (`getBoundingClientRect`) off the rendered DOM — it never sets `position` on `.fc-v-event` or `info.el`, because FullCalendar sizes events by absolute top/bottom to keep them proportional to duration, and overriding that makes an event grow to fit its text instead of its time span. The station connector and the hover/selection radius lift added since the animate pass follow the same discipline: they react to `hoverId`/`selectedId` state and repaint through the same `scheduleDraw()` loop, never touching FullCalendar's DOM beyond the `dataset.stopId` attribute `eventDidMount` already sets.

## Elevation & Depth

Flat by material, not flat by accident: `box-shadow` does not appear as a real elevation device anywhere in the stylesheet. Depth is read entirely from two things — a 1px hairline border (`--hairline`) and which of four enamel steps a surface sits on. `--enamel-sink` (`#070C22`, recessed: rail, tray, map background, the Line's own track casing) is darker than `--enamel` (`#0B1230`, ground: page background, the Line's body) which is darker than `--enamel-raise` (`#0E1838`, raised at rest: station/event boxes, sheets, dropdowns) which is darker than `--enamel-hover` (`#12204A`, raised further on interaction: a hovered or selected station card, a hovered search result). A surface reads as "above" another by being a lighter shade of the same fired blue, never by a cast shadow.

The one exception: a pinned map marker's double ring is built from `box-shadow: 0 0 0 3px var(--porcelain), 0 0 0 5px var(--enamel)` — used to fake a second concentric circle a plain `border` can't produce on a MapLibre marker element, not to imply elevation.

### Named Rules
**The Flat-By-Material Rule.** Depth is tonal, not cast. A surface is "above" another because it is a lighter step of the same enamel plus a hairline border — never a shadow, never a blur.

## Shapes

**Radius is deliberately split now, not absolute.** The system spent a finish pass at a hard `border-radius: 0` everywhere but true circles, and the user pushed back on the result directly — three escalating rounds of "harshly square," "stiff and boxy" — and, asked a structured question about it, chose to soften tool chrome while keeping the diagram itself hard-edged. `--radius-chrome: 5px` is the reversal: a single considered radius value, applied only to chrome, never to the diagram.

**Chrome Radius, Diagram Stays Sharp.** `--radius-chrome` (5px) applies to: `.btn` (every variant), the Day Nav pill, `.search input`, `.search-results`/`.search-hit`, `dialog.sheet` and its textarea/field inputs, `.siding` cards, `.toast`, `.pane-count`, `.rail-note`, and `.maplibregl-ctrl-group` (the map's own zoom-control chrome). It explicitly does **not** apply to `.fc-v-event` or anything inside `.line-pane` (the Line has no card shape left to round — see Cards / Containers), the map's route/track rendering in `map.js`, or `.pin-tick`/`.status-dot` (already circular — these are the metaphor's own vocabulary, not softened chrome, and rounding a circle is a no-op anyway). The comment at the top of that section of `style.css` states the same split in the code itself: "the Line's diagram, its events, and the map's route rendering never use this; circles stay the only curve there."

Circles remain the system's only curve inside the diagram: station ticks on the Line, the siding tick, the map pin, the status dot. A hard rectangle is still the default shape everywhere chrome radius doesn't reach.

The ground's hairline-mesh texture moved from a single global `body::before` to a `background-image` painted directly on the two enamel-sink panels (`.rail`, `.tray`), composited in one shorthand with `var(--enamel-sink)`. The global version was removed because it was never actually visible: every panel paints its own fully opaque ground colour on top of it, so a single fixed layer behind the whole app painted nothing anyone ever saw. The mesh itself is unchanged in shape (45°/90° lines, tiled 168×168px) with a slightly adjusted stroke (`#131b3f`, baked into the image rather than layered under a separate `opacity`).

### Named Rules
**Chrome Radius, Diagram Stays Sharp.** Tool chrome (buttons, inputs, dialogs, toasts, the siding tray, the map's zoom control) rounds at `--radius-chrome` (5px). The diagram — the Line's stations, the map's route and track rendering — stays exactly `0`, with circles as its only curve. A new component reaching for a radius asks first which side of that line it's on; there is no third value.

## Components

### Buttons
- **Shape:** `--radius-chrome` (5px) — a real corner now, not the hard-zero rectangle every other component used to share. 1px border (transparent or coloured depending on variant), padding `12px 16px` (`--space-3 --space-4`) uniformly across every variant.
- **Primary:** scarlet fill, porcelain label text (uppercase, `ui-text`/13px, 600, 0.12em tracking). Hover deepens the fill to `#C4121F` — never lightens — and its arrow icon travels `translateX(3px)` on `--t-base`/`--ease-out`. `:active` inverts the whole button: fill becomes enamel, border and text become scarlet — a punched-out press state rather than a darken-on-click. While Optimise is working (`.is-working`) the arrow loops a `depart` keyframe (translateX −3px → 9px, opacity 0 → 1 → 0, 900ms, infinite) instead of sitting still, and the button ignores further clicks (`pointer-events: none`).
- **Ghost:** transparent fill, `--hairline` border, ink-mid label; hover brightens the border and label toward porcelain.
- **Line:** transparent fill, cobalt border, `--cobalt-ink` label (see Colors → Cobalt Ink); hover fills solid cobalt with porcelain text. This is the only button that borrows the flexible-station ink. Its state-machine use is the maps-handoff button — see Maps Handoff, below.
- **Danger:** scarlet border at 40% alpha, scarlet label, pinned to the far side of a sheet's action row (`margin-right: auto`); hover fills solid scarlet.
- **Press feedback:** every button presses `translateY(1px) scale(.99)` on `:active` — a small compression, not just a shift.
- **Disabled:** `opacity: .32`, `cursor: not-allowed`, and `:active`'s press transform is suppressed.
- Ordinary button-state transitions (background, border, colour, the press transform) run at `--t-fast` (120ms) on the system's original ease, `cubic-bezier(.2, .7, .3, 1)`; the two motions that travel — the arrow's hover slide and its working-state loop — use the second curve. See Motion System, below.

### Chips / Badges
- **Style:** no fill, 1px border in `currentColor`, `micro`/11px uppercase label at 0.1em tracking, weight 700 (state-asserting, per the Weight rule) — the one `micro`-step use that's unambiguously a label, never reading text.
- **Variants:** `--pin` (porcelain, reads "Fixed") and `--unfit` (amber, reads "Won't fit"). There is no badge for the flexible/cobalt state — flexible is the diagram's unmarked default, so only the two exceptions (fixed, won't-fit) need a chip.
- **Radius:** none. A badge is diagram content riding on a station, not tool chrome, so it stays outside the `--radius-chrome` split along with the rest of the Line.

### Cards / Containers
The Line's stations are **not** a card — the animate pass de-boxed them. `.fc-v-event` sits on `background: transparent; border: 0` at rest; the label reads directly on the enamel ground, joined to the track by the tick and the SVG connector (see The Line, below) so tick, connector, and label read as one object instead of a dot floating beside a box. (`.fc-v-event` still transitions `background` on `--t-fast`/`--ease` and `transform` on `--t-fast`/`--ease-out` — the latter is what lets FullCalendar's native drag/resize interactions settle smoothly.) This is diagram, not chrome, so it carries no radius — `--radius-chrome` never reaches it, matching the Shapes split.
- **Hover / selection surface:** a `::before` pseudo-element spans `inset: 0 0 0 -34px` — reaching back past the label all the way to the track — filled `--enamel-hover`, `opacity: 0` at rest, fading to `.62` on hover and `.9` on `.is-selected`. Because the surface sits under the tick, the connector, *and* the label, touching any part of a station lights the whole object.
- **State moved off the border**, since there is no border left to carry it: `.is-unfit` recolours `.ev-name` amber; `.is-nogeo` recolours `.ev-name` ink-mid (a failed geocode is still communicated without a fourth colour — just by text tint now, not a dashed border). A pinned stop carries no card-level styling at all any more; "Fixed" is read from the Line's own porcelain ring and the badge alone.
- **Coupling to record:** `LABEL_INSET` in `schedule.js` (`34`) must stay equal to `.fc-v-event`'s `margin-left` (`34px`). The SVG connector is drawn to `labelX − 3`, and `labelX` is derived from that same inset — change one without the other and the tick and its label drift apart again, reopening the "two objects" problem the animate pass fixed.
- **Sidings** (the tray's unscheduled-stop cards, `.siding`) are still real boxed cards, unaffected by the de-boxing since a siding isn't on the diagram — enamel fill, hairline border, `--radius-chrome` (5px, since a siding is tool chrome, not the diagram), `grab` cursor. Hover raises the fill to enamel-raise, translates the row `3px`, and scales its tick ×1.35; a press (`:active`) translates `1px` and scales ×.995; a stop mid-drag drops to 40% opacity.
- **No left-edge accent.** A coloured left border was tried on these containers during the finish pass and removed from five components. It is an explicit anti-pattern here: colour lives on the Line and the route, not as a decorative flag on a container.

### Inputs / Fields
- **Style:** enamel fill, 1px hairline border, `--radius-chrome` (5px), 8–12px padding (`--space-2`/`--space-3`), `ui-text`/13px.
- **Focus:** the hairline border turns solid cobalt — the same ink as the system's universal `:focus-visible` outline, so focus reads identically everywhere.
- **State note:** a small helper line under a field reports state in text colour — green for confirmed ("Located."), amber for failed ("Address not found."). This is the Attention-Ink Rule at work outside the diagram: amber flags "look here" on a form the same way it does on the now-line or a warn toast, without touching the Line's own won't-fit meaning.

### Navigation
The Day Nav is a three-cell hairline-bordered grid (34px / 1fr / 34px — a layout metric, unrelated to the type scale), itself rounded at `--radius-chrome` with `overflow: hidden` clipping the three cells to that corner: prev/next arrow buttons at the `compact-stat` step (19px, unweighted/400 — a named exception, see Weight) in ink-mid that fill hairline-grey and turn porcelain on hover, flanking a centre date cell in Archivo Narrow 700, `ui-text`/13px (a named exception to `ui-text`'s representative weight, see Weight), uppercase, porcelain, divided by vertical hairlines. A separate "Today" pill sits beneath at the `micro` step (11px, 0.14em, ink-dim) and turns `--cobalt-ink` on hover — the one piece of chrome text that borrows a state ink to signal "go."

### Maps Handoff
The two-button "Copy Maps link" / "Open" pair is gone, replaced by one button (`#btnMapsAction`, `.btn--line.btn--wide`) that toggles between two states rather than offering two separate actions:
- **At rest:** reads "Copy Maps link." Clicking it copies the current route's Maps URL.
- **After a successful copy:** relabels to "Open" and gains `.is-ready`, which fills the button solid cobalt (`.btn--line.is-ready { background: var(--cobalt); color: var(--porcelain); }`, a rule declared immediately after `.btn--line:hover`) — the button visibly changes state rather than just accepting a second meaning silently. Its hover darkens further to `#3D6EFF`. Clicking again in this state opens the link instead of re-copying it.
- **Reverting:** if the underlying route's stop *sequence* changes, the button drops `.is-ready` and reverts to "Copy Maps link" automatically, because the copied link is now stale. A same-order, time-only drag correctly does **not** revert it — the Maps URL encodes lat/lng stop order, not clock times — only an actual sequence change (a reorder, a deletion) invalidates it.
- **Shape/style:** otherwise an ordinary `.btn--line` — transparent fill, cobalt border, `--cobalt-ink` label at rest, `--radius-chrome`, full-width in the rail.

### Status & Feedback
- **Status line** (`.status`): a `micro`/11px uppercase ink-dim label beside a 7px circular dot — green for ready, amber (pulsing) for busy, scarlet for error. The only animated element in the system besides toasts (`@keyframes pulse`, muted to 0.01ms under `prefers-reduced-motion`).
- **Delta panel** (`.delta`): a hairline-bordered strip in a tinted, low-alpha version of the result colour, now `--radius-chrome`-rounded — green background/border at ~8%/30% alpha for "less driving," amber for "more driving" — holding a `compact-stat`/19px tabular figure and a `micro`/11px label. Gated by `[hidden]`, not a display toggle.
- **Toasts**: enamel-raise, ink-dim border by default, `--radius-chrome`-rounded, recoloured per kind (warn → amber, error → scarlet border with `--scarlet-lift` text, ok → green border with `--green-lift` text). The lift tokens exist for exactly this: toast text needs to read clearly on the dark surface without matching the core route/confirmation ink exactly, so each gets a lighter, tokenized variant rather than an inline one-off.

### The Line (signature)
The Line is an SVG overlay (`#lineOverlay`) painted on top of FullCalendar's real time grid — it never participates in layout, only reads it, redrawn on a request-animation-frame loop (`scheduleDraw`) whenever the grid scrolls, resizes, hovers, or its data changes.
- **Horizontal position:** the track sits at the event column's live left edge (measured via `getBoundingClientRect`, never hardcoded — a fixed offset would paint over hour labels in any locale with wider ones) plus an 18px gutter (`TRACK_GUTTER`). The label column begins a further 34px out (`LABEL_INSET`) — the coupling this creates with `.fc-v-event`'s `margin-left` is recorded under Cards / Containers.
- **Track:** one continuous two-pass stroke from the first to the last visible station — an 8px `#070C22` (enamel-sink) casing under a 4px `#E21D2D` (scarlet) ink line, both round-capped. These widths are hardcoded in `schedule.js`, not drawn from the CSS custom properties `--track-w`/`--tick-r` (both `6px`) — those two tokens are declared in `:root` but never referenced anywhere in the CSS or JS. The JS values above are the system's real, shipped track geometry.
- **The connector.** Since the animate pass, every station also draws a `<line>` from the tick's edge to `labelX − 3` — resting at `--connector` (`#2A3A66`, `stroke-width: 1`), thickening to the station's own ink at `stroke-width: 1.6` when the station is hot (hovered or selected). Without it the tick and its label read as two separate objects; the connector is what makes touching one feel like touching the other.
- **Hover / selection lift.** A station's ring radius scales ×1.34 and its inner dot grows from `r: 2` to `r: 2.8` when it is hovered or selected (`hoverId`/`selectedId`). Hover is driven by FullCalendar's `eventMouseEnter`/`eventMouseLeave`, which set `Schedule.hoverId` and call `onHoverStop` — wired in `app.js` to `map.setHover(id)`, which lifts the matching map pin at the same time (`.pin.is-hover .pin-tick { transform: scale(1.4) }`, the same value as a directly-hovered pin). Hovering a station on the Line and hovering its pin on the map are the same visual event, reachable from either surface.
- **Drive-leg ticks:** for any gap ≥16px between two stations, a small enamel-filled tag punches over the track at the leg's midpoint — a 2.5px ink-dim dot plus a 9.5px Archivo label reading "`N min`" in ink-mid. A drive leg is always neutral-grey here, by explicit design: "amber is reserved for the unfit state alone — one ink, one meaning" (verbatim code comment), so even a very long leg never turns warning-coloured.
- **Stations:** a fixed appointment draws as a larger hollow ring (r 7.5px at rest, 3px stroke, porcelain); a flexible stop draws as a smaller ring (r 5px at rest) with a solid dot core in the same ink, because "radius alone was a 2.5px distinction doing work colour should share" (verbatim code comment) — the filled core, not just the size, is what reads as "flexible" at a glance. A won't-fit stop reuses the flexible geometry recoloured amber. Every ring's centre is filled with the ground enamel, so a station reads as a punched hole in the track rather than a solid marker.

### The Recoloured Basemap (signature)
The basemap is never a stock tile set. `map.js` fetches OpenFreeMap's `dark` style and rewrites every paint colour by luminance into the interface's own enamel ramp before the map ever renders (`tintStyle` / `enamelise`). Ramp endpoints:
- **Ground/default** (anything not water, road, or label): mixes `#070C22` (enamel) toward `#222E58` by `luminance × 1.25`, clamped to [0, 1].
- **Water:** mixes `#0A163C` toward `#1E3A78` by `luminance × 0.7` — water stays dark across the whole source range.
- **Road:** mixes `#070C22` toward `#354780` by `luminance × 1.9`, clamped to [0.12, 1] — the 0.12 floor keeps even the dimmest source road visible against the ground.
- **Label:** mixes `#5A6C99` toward `#8FA3CC` by raw luminance, unclamped — preserving the source style's own text-size hierarchy (a capital city stays brighter than a hamlet).
- **Halo:** flattened to plain enamel (`#070C22`) regardless of source luminance, so every text halo disappears into the ground instead of competing with it.

Role is detected per layer: any paint key containing "halo" → halo; any `symbol`-type layer → label; a layer id matching `water|waterway|ocean|river` → water; matching `highway|road|rail|aeroway|transit|bridge|tunnel` → road; everything else → ground.

The route itself is drawn as three MapLibre layers sharing the Line's own casing-then-ink construction, all on the only saturated, non-recoloured colours on the map: `dr-route-casing` (7px `#070C22` widening to 12px at zoom 14) sits underneath, always visible, and one of two ink layers sits on top of it — `dr-route-ink` (a gradiented `#E21D2D` line, 3.5px→6px, for a real OSRM route; see Motion System, below, for how it draws itself on) or `dr-route-est` (a flat, dashed `#E21D2D` line at 60% opacity, `[2, 1.6]` dash, for an estimated straight-line guess). The two ink layers are mutually exclusive and switched by `visibility`, never drawn together, so a guessed route is never mistaken for a real one.

Map pins are a 20px porcelain circle (3px enamel ring) holding the stop's sequence number, inverted from every other numeral in the system (enamel-on-porcelain here, porcelain-on-enamel everywhere else) because the pin is the one light object sitting on a dark map. A pinned (fixed-appointment) stop gets a double-ring halo via `box-shadow` — the system's only real use of that property. An active (currently-focused) pin scales to 1.28× and switches to cobalt fill with porcelain text — picking up the Line's own focus ink — so it stays visually distinct from a won't-fit pin's amber, which the Attention-Ink Rule reserves for that one meaning alone. A hovered pin — or one whose matching station is hovered/selected back on the Line — scales ×1.4 on `--t-base`/`--ease-out`.

### Motion System

Five timing values, all named, split cleanly by what they're for. `--t-fast` (120ms) and `--t-base` (220ms) carry ordinary state change — hover, focus, colour, background — on the system's original ease, `cubic-bezier(.2, .7, .3, 1)`. `--t-move` (440ms) and `--ease-out` (`cubic-bezier(.16, 1, .3, 1)`) are reserved for spatial motion: travel, not just a state flip. Three focal moments carry that weight:
- **Reorder** (`captureRects()` / `playReorder()` in `schedule.js`). `captureRects()` records every station's screen position before Optimise runs; `playReorder()` measures the new positions afterward and plays a FLIP transform on each one — `translateY` from old position to new, opacity `.75 → 1` — staggered `26ms` per station and capped at `160ms` of total stagger, so the whole day resequences as something watched rather than something reported. Nothing animates a layout property. The call hardcodes `460ms` and repeats the `--ease-out` curve as a literal string rather than reading the CSS custom properties — the Web Animations API used here can't resolve them — so the real duration is `460ms`, 20ms longer than the `--t-move` token it's conceptually tied to. Skipped entirely under reduced motion.
- **Count-up** (`countTo()` in `app.js`). The delta figure counts from `0` to its saved/cost value over `620ms` on a hand-rolled ease-out cubic (`1 − (1−k)³`), so the saving reads as something that happened rather than a number that simply appeared. Writes the final value immediately under reduced motion.
- **Route draw-on** (`_drawOn()` in `map.js`). The route paints itself on over `720ms`, the same ease-out-cubic shape, by sweeping a `line-gradient` stop across `line-progress` from 0 to 1. Jumps straight to the fully-drawn gradient under reduced motion.

**The MapLibre gradient/dash conflict.** `line-gradient` and `line-dasharray` are mutually exclusive on a single line layer — setting a dash on a gradiented layer silently kills the gradient and the route renders black. That is the reason the route is two separate ink layers rather than one layer toggled by paint property (see The Recoloured Basemap, above): `dr-route-ink` carries the gradient and the draw-on animation for a real route, `dr-route-est` carries the dash for an estimated one, and `visibility` switches between them. The source needs `lineMetrics: true` for `line-progress` to exist at all.

**Supporting feedback**, all on the token family above: a siding translates `3px` on hover and its tick scales ×1.35; a siding being pressed translates `1px` and scales ×.995; every button presses `translateY(1px) scale(.99)` on `:active`; the Optimise button's arrow travels `translateX(3px)` on hover and loops a `depart` keyframe (`900ms`, `--ease`, infinite) while `.is-working`; a map pin scales ×1.4 on hover *or* when its matching station is hovered/selected on the Line — two different inputs producing the same visual event.

**Reduced motion.** `@media (prefers-reduced-motion: reduce)` clamps every transition to `90ms` and every animation to a single iteration, and explicitly zeroes the spatial hover transforms on sidings, stations, and the Optimise arrow. That CSS override is a floor, not the whole mechanism: `playReorder()`, `countTo()`, and `_drawOn()` each check `prefers-reduced-motion` directly in JavaScript and take a static branch, because a FLIP `element.animate()` call and a `requestAnimationFrame` easing loop aren't reachable by a stylesheet override alone. The result the finish review verified: zero spatial animation under reduced motion, with every colour, opacity, and count-up value still landing on its final, legible state.

## Do's and Don'ts

### Do:
- **Do** keep colour concentrated on the Line and the route. Scarlet, cobalt, and amber only mean something when they appear on the diagram or the map — everywhere else, reach for the neutral ramp.
- **Do** treat `--ink-dim` (`#7C8AAC`) and the primary hover `#C4121F` as contrast-derived values, not stylistic choices — 5.05:1 and 6.14:1 respectively are the floor, not a target to loosen.
- **Do** round tool chrome at `--radius-chrome` (5px) and keep the diagram — the Line's stations, the map's route/track — at exactly `0` with circles as its only curve. This is a considered, user-chosen split, not the absolute zero-radius rule this document used to record; see Shapes.
- **Do** reach for one of the eight named `--fs-` roles (`micro`/`ui-text`/`sub-head`/`compact-stat`/`wordmark`/`secondary-lead`/`mobile-lead`/`primary-lead`) and one of the three `--lh-` line-heights, never a bare pixel value. If a new component seems to need a size or line-height the scale doesn't have, that's a signal to reuse the nearest role, not add one.
- **Do** read geometry off FullCalendar's DOM in the Line overlay; never write `position` back onto `.fc-v-event` or `info.el`.
- **Do** run ordinary state change (hover, focus, colour, background) on `--t-fast` (120ms) or `--t-base` (220ms) with the system's original ease, `cubic-bezier(.2, .7, .3, 1)`. Reach for `--t-move` (440ms) and `--ease-out` (`cubic-bezier(.16, 1, .3, 1)`) only for something that travels — a reorder, a count-up, a route drawing itself on. The two curves are never swapped.
- **Do** use amber freely in chrome for anything that genuinely needs attention — advisories, warnings, the now-line, busy status, a failed form field. The moment amber touches a station or a map pin, though, hold it to exactly one meaning: won't-fit.
- **Do** keep the tick, connector, and label of a station acting as one object. If a future change gives any one of them its own independent hover/selection treatment, check it against `LABEL_INSET`/`margin-left` first — that's the coupling that keeps them aligned.
- **Do** draw every gap, padding, and margin from `--space-1`–`--space-7` (or the `--pad`/`--gap` aliases). A one-off pixel value here is exactly the pattern the user reacted to when this document still said padding was set locally per component.

### Don't:
- **Don't** add a coloured left-edge accent to a card or container. It was built into five components during development and removed in the finish pass — it is an anti-pattern here, not an available style.
- **Don't** add a shadow or a gradient anywhere. The one `box-shadow` in the system (a pinned map pin's double ring) exists because MapLibre markers can't fake a concentric ring with a border; it is not precedent for adding shadows elsewhere. Depth comes from the four enamel steps and a hairline, never from either.
- **Don't** let amber mark a routine drive leg or a routine (non-unfit) station/pin state — that collision shipped once (an active map pin rendered identically to a won't-fit pin) and was fixed by moving the active state to cobalt. Amber's reach into general chrome attention-getting stops the moment it touches the diagram.
- **Don't** rely on a bare `display` rule to hide something the app also sets `[hidden]` on — `[hidden] { display: none !important; }` in the reset is what makes every `.hidden`/`hidden`-attribute toggle in the system actually work (the delta panel, the search-results dropdown, the Maps-limit note, the map's loading scrim). A component-level `display: flex` on a hideable element silently defeats it.
- **Don't** invent a fourth state ink for the Line or the map. Porcelain, cobalt, and amber are the complete set; a new state should reuse one of the three or be represented by shape/style (as the no-geocode text tint already does) rather than by colour.
- **Don't** add a second ambient, looping animation. The busy status dot is the system's one permitted loop; an infinitely pulsing dot on the now-indicator was built, flagged by the detector as decoration competing with the Line's own focal moments, and removed. A static amber dot is the answer there, not a second lamp.
- **Don't** give a station its own background/border card again. The tick-connector-label unit and its shared `::before` hover surface are what replaced the boxed event — reintroducing a per-state border would fight the connector for the eye's attention and undo the point of the de-boxing.
- **Don't** round the diagram, and don't leave a new piece of tool chrome unrounded. `--radius-chrome` is a considered, user-chosen split, not a suggestion either side can drift across — a rounded station or a hard-cornered dialog are both drift, not variety.
- **Don't** reintroduce a bare pixel font size, weight, or line-height outside the documented roles. The prior scale's failure mode was exactly this: one-off values accumulating component by component until "doesn't make sense" was the honest description.
