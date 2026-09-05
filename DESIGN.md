---
name: dayroute
description: A day of driving read as a rail line, not a list — the schedule is the diagram.
colors:
  green: "#0E7A46"
  green-ink: "#095430"
  green-deep: "#0A5C34"
  green-edge: "#0E7A4655"
  green-wash: "#0E7A4614"
  green-tint: "#0E7A4622"
  clay: "#B0431F"
  clay-ink: "#8F3517"
  clay-edge: "#B0431F55"
  clay-wash: "#B0431F12"
  clay-rim: "#B0431F66"
  paper: "#E6E1D4"
  paper-raise: "#FFFFFF"
  paper-sink: "#DAD4C4"
  paper-hover: "#F3F0E7"
  paper-veil: "#FFFFFFCC"
  rule: "#C9C2AF"
  rule-soft: "#C9C2AF66"
  ink-strong: "#141814"
  ink: "#2A302C"
  ink-mid: "#454E49"
  ink-dim: "#5E6661"
  scrim: "#141814B8"
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
  hair-wall: "2px"
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-7: "32px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.paper-raise}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.green-deep}"
  button-primary-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.green-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-mid}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  button-line-ready:
    backgroundColor: "{colors.green}"
    textColor: "{colors.ink-strong}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.clay-ink}"
    rounded: "{rounded.chrome}"
    padding: "12px 16px"
  station-fixed:
    textColor: "{colors.ink-strong}"
    typography: "{typography.micro}"
  station-flexible:
    textColor: "{colors.green}"
    typography: "{typography.micro}"
  station-unfit:
    textColor: "{colors.clay}"
    typography: "{typography.micro}"
---

# Design System: dayroute — The Paper Line

## Overview

**Creative North Star: "The Paper Line"**

dayroute's thesis is unchanged by this pass: the schedule *is* the diagram, not a list beside a map. A vertical time axis (The Line) places every stop at its real clock position, so the empty space between two stations is drawn to scale and IS the drive leg. What changed is the material the diagram is printed on. The system's original world — fired enamel, midnight blue, lit by scarlet/cobalt/amber — is entirely gone, replaced at the user's explicit, direct instruction after it failed in the product's own stated use scene: read on a phone, in a car, in the sun. The direction contract embedded in `index.html`'s `<body>` comment records the change plainly: *"Palette replaced at the user's direction; the dark original lost to a daylight use scene."* There was no fresh Impeccable direction round behind this world the way there was for the enamel one (seed `3faa1e80`); the code — `style.css`, `schedule.js`, `map.js` — is the only design record, exactly as it was before.

The new world reads as a rail diagram printed on warm oat stock: one paper ground, cards raised to true white, one green line ink for the route and everything routine, and clay — green's complement — held to exactly one job: won't-fit and collision, never anything ordinary. The card/ground separation is not a stylistic pick; it is a measured floor. Paper Raise on Paper is **1.31:1**, and that number exists in this document because the previous theme's identical step — its raised "above" surface against its ground — measured **1.12:1** and was reported twice, independently, in the plain words "events are the same colour as the calendar, hard to visually see." `--ink-dim`, the system's dimmest legible text, holds its own measured floor: **4.53:1** on paper, "the floor, not a soft grey" (verbatim from the stylesheet).

Confirmed rejections, all visible in the shipped code: no shadow anywhere except the map's own markers (`.pin-tick`/`.pin-stem`/`.pin-label`, all three now, not one hack for one state — see Elevation & Depth), no gradient (the ground texture is still an SVG hairline mesh, its stroke baked directly into the data URI), and no stock basemap tile set (OpenFreeMap's `positron` style is recoloured at load into the paper ramp by `map.js`'s `enamelise()` — a function name that is now, honestly, a misnomer left over from the enamel world; nothing about its output touches enamel any more). The chrome/diagram radius split survives the palette swap untouched: tool chrome rounds at `--radius-chrome` (5px), the diagram and the map's own route/track stay exactly `0`, circles their only curve.

**Key Characteristics:**
- Ground is a material, not a backdrop: warm paper throughout (`--paper`), cards raised to pure white (`--paper-raise`) at a measured, load-bearing 1.31:1 step — a floor, recorded here because dropping toward the old theme's 1.12:1 is the exact failure this palette exists to fix.
- Two line inks, not four: green is the route, the primary action, and a flexible station; clay is its sole complement — attention, won't-fit, and collision, never anything routine. Down from the enamel world's three state inks plus a fourth confirmation-only accent.
- Both line inks carry a deepened text-only variant, because each raw value fails the 4.5:1 small-text floor on paper (green measures 4.13:1, clay 4.38:1): `--green-ink` reaches 6.93:1, `--clay-ink` reaches 5.98:1. This is the same shape of fix the enamel world's `--cobalt-ink` was, for the same reason — a saturated line ink and a legible small-text colour are rarely the same value.
- The Line is drawn in weighted, proportional segments, not a dot in a gap: heavy (7px) while stopped at a station, solid (3px) while actually driving, dashed (3px, `2 4`) across slack — and the drive/slack split is proportional to real minutes, so the shape itself answers "do I have room here?" before any number is read.
- `schedule.js` now reads every Line colour from CSS custom properties via `getComputedStyle` at draw time, and `app.js`'s legend does the same for its three swatches — neither hardcodes a hex. This is recorded as a rule because it is the second time a palette replacement in this project left literal colours quietly pointing at the dead theme (see Colors → The Tokenised Derivative Rule).
- Map markers are real pins — a 26px badge on a 9px stem, anchored so the stem's tip sits on the coordinate — with a styled hover label replacing the browser's native tooltip. `box-shadow` is permitted on the pin alone, nowhere else: a marker floats over arbitrary, unpredictable tile colour and cannot separate from it by tonal step the way every other surface in the system does.
- The basemap is Positron (light), not a dark style — recoloured by source luminance onto the same paper the interface is printed on, so the map reads as a panel of the same document rather than a foreign tile set.
- The type scale (eight named roles, 11–39px, ≈×1.2), the 4px spacing grid, the `--hair`/`--hair-wall` border-weight hierarchy, the chrome/diagram radius split, and the five-value motion system all carry over from the prior build unchanged — reverified against the current code, not assumed.

## Colors

Two saturated line inks — green and clay, one hue apart, complements of each other — sit on a warm paper neutral ramp. Every alpha wash or hover-deepened fill derived from either ink is its own named token; none is inlined.

### Primary — Green
- **Green — Route & Flexible Ink** (`#0E7A46`): the track through the Line, the recoloured basemap's route ink (under a white casing), the primary button fill (Optimise), a flexible station's ring-and-core on both the Line and the map, `::selection` background, the checkbox `accent-color`, the search input's focus border and the search-results border, and the legend's "Flexible" swatch. It is the system's single "go" colour.
- **Green Deep** (`#0A5C34`, 6.20:1 on paper): the pressed/hover state of any green fill — `.btn--primary:hover` and `.btn--line.is-ready:hover` both deepen here. It never lightens on interaction.
- **Green Ink** (`#095430`, 6.93:1): green as small text. Raw green measures only 4.13:1 on paper — under the 4.5:1 small-text floor — so wherever green sits as *text* rather than a fill or a ring (the Line's drive-duration chip label, `.btn--line`'s resting label, `.daynav-today`'s hover state, an `is-multiselected` station's outline) it reaches for green-ink instead.
- **Green Edge / Wash / Tint** (`#0E7A4655` / `#0E7A4614` / `#0E7A4622`): three low-alpha derivatives of green, each tokenised rather than inlined. Edge and Wash together frame the positive ("less driving") delta panel's border and background; Tint alone washes FullCalendar's own drag-to-create highlight.

### Secondary — Clay
- **Clay — Attention Ink** (`#B0431F`): green's complement, and the system's only other state-carrying hue. On the diagram — a station tick or a map pin — it means exactly one thing: won't-fit or collision, never a routine drive leg. Outside the diagram it is the general chrome attention ink: the rail-note advisory, the warn and error toasts, the stop sheet's failed-geocode note, the danger button, and the status dot for **both** "busy" (pulsing) and "error" (static) — the two now share this one ink, since the palette holds no fourth colour to spare for a separate busy identity; only the pulse tells them apart.
- **Clay Ink** (`#8F3517`, 5.98:1): clay as small text. Raw clay measures 4.38:1 on paper — again under the small-text floor — so the danger button's label, the siding-delete hover state, and a won't-fit pin's colouring reach for clay-ink instead.
- **Clay Edge / Wash / Rim** (`#B0431F55` / `#B0431F12` / `#B0431F66`): clay's low-alpha derivatives — the negative ("more driving") delta panel's border and background, the rail-note's border, and the danger button's resting border, respectively.

### Neutral — Paper & Ink
- **Paper** (`#E6E1D4`): the ground — page background, the Line's own body, `<meta name="theme-color">`, the favicon's ground. A deliberately warm oat, not a plain white or grey (see Named Rules).
- **Paper Raise** (`#FFFFFF`): the "above" surface, at true white — a scheduled station's card, sheets, search-result dropdowns, the route's own map casing, a pin's badge fill. Measured 1.31:1 against Paper; see The Card Floor Rule.
- **Paper Sink** (`#DAD4C4`): the "below" surface — the rail, the tray, the map's own background and loading scrim, both hairline-mesh panels.
- **Paper Hover** (`#F3F0E7`): the interaction lift between Paper and Paper Raise — a station's hover/selection wash, a search-hit's hover fill.
- **Paper Veil** (`#FFFFFFCC`): translucent white behind the map's attribution strip, so attribution text stays legible over whatever tile colour happens to sit underneath it, without a hard opaque box.
- **Rule / Rule Soft** (`#C9C2AF` / `#C9C2AF66`): the system's one hairline colour and its low-alpha variant, reserved for FullCalendar's non-hour minor gridlines.
- **Ink Strong** (`#141814`, 13.74:1): headings, lead figures, brand — and, doubling as a state ink, a fixed appointment's station ring, map pin, and "Fixed" badge.
- **Ink** (`#2A302C`, 10.33:1): default body text.
- **Ink Mid** (`#454E49`, 6.60:1): secondary text, ghost-button labels, the day-nav chevrons, a hovered station's border.
- **Ink Dim** (`#5E6661`, 4.53:1): the dimmest legible text in the system — every 11px meta/address/label line. Specified, not guessed: 4.53:1 is stated as "the floor, not a soft grey" directly in the stylesheet.
- **Scrim** (`#141814B8`): the dialog backdrop — ink-strong at high alpha, not a generic black.

**Browser-native surfaces are themed too.** `::selection` sets green background with ink-strong text. Scrollbars use `--rule` at rest, brightening to `--ink-dim` on hover, at a fixed 9px thickness — unchanged mechanism from the prior world, just recoloured.

### Named Rules
**The Card Floor Rule.** Paper Raise on Paper measures 1.31:1 — the separation that makes a scheduled event legibly distinct from an empty grid row. This is a floor, not a target to erode: the previous world's identical "raised above ground" step measured 1.12:1 and was reported twice, independently, as illegible. A future material change may not reintroduce that gap.

**The Deepened-Ink Rule.** Both line inks fail the 4.5:1 small-text floor at their raw value — green at 4.13:1, clay at 4.38:1 — so each carries a deepened, text-only sibling (`--green-ink` at 6.93:1, `--clay-ink` at 5.98:1) for every place the colour sits as text rather than a fill or a ring. The same shape of fix existed in the prior world as `--cobalt-ink`; it recurs here because a saturated line ink and a legible small-text colour are rarely the same value, in any palette.

**The Two Inks Rule.** Exactly two hues carry state on the diagram and the map — green (route, flexible) and clay (won't-fit, collision) — plus ink-strong, a neutral extreme that marks a fixed appointment without being a third hue. No new colour is introduced on the Line or a pin for a state these two, plus ink-strong, don't already cover.

**The Tokenised Derivative Rule.** Every alpha wash, hover-deepened fill, or backdrop tint is a named custom property — `--green-edge`, `--clay-wash`, `--scrim`, and seven more like them — never an inline hex or `rgba()` outside `:root`. This is written down because it has already failed twice in this project's history: a palette replacement leaves bare literals silently pointing at the dead theme unless every derived value is tokenised in the same pass as the primaries. Nine such literals were caught and tokenised in the same session that produced this document; a bare colour value found outside `:root` in a future review is itself the signal that the rule was skipped.

**One known gap, recorded rather than hidden:** `.toast[data-kind="ok"]` sets `color: var(--green-lift)` — a token that does not exist anywhere in `:root`. This is a leftover reference to the previous world's `--green-lift`, not a decision; an undefined custom property makes the whole declaration invalid at computed-value time, so an "ok" toast's text silently falls back to the inherited `--ink` instead of reading in a distinct green. It is flagged here as a defect to fix (add a `--green-lift` token or point the rule at `--green-ink`), not canonised as how ok-toasts are supposed to look.

## Typography

**Display Font:** Archivo Narrow (weight 700) — every display figure and the brand wordmark.
**Body Font:** Archivo (weights 400/600/700) — everything else.
**Mono Font:** `ui-monospace, SFMono-Regular, Menlo` — the paste-a-list textarea (13px, on-scale) and inline `<code>` (a relative `0.92em`, the one type value outside the fixed scale on purpose, since it has to shrink or grow with the text around it).

**Character:** unchanged from the prior world — one grotesque family doing two jobs. Archivo Narrow's condensed width carries every display figure and the brand wordmark; full-width Archivo carries labels and reading text. Every numeral that counts something renders tabular (`font-feature-settings: "tnum" 1, "cv05" 1` globally on `body`, reinforced with `font-variant-numeric: tabular-nums` on the figures that matter most).

The palette replacement did not touch type. The eight-role scale, its weight rule, and its three line-height roles are reverified against the current stylesheet and carried forward exactly.

### The Type Scale

| Token | Size | Role | Where it lands |
|---|---|---|---|
| `--fs-1` | 11px | micro | Badges, meta/address lines, footnotes — the system's floor. Both the uppercase signage caps (brand-sub, day-nav "Today," totals labels, delta label, pane count, legend, status, form field labels, map attribution) and plain reading-adjacent lines (rail-note, station meta, addresses, the field's confirm/error note). |
| `--fs-2` | 13px | UI text | Buttons, inputs, names, sequence numbers — the most-shared step. Both interactive/identifying UI text and reading text (sheet help copy, form field values, the paste textarea, toast text). |
| `--fs-3` | 16px | sub-head | Declared for dialog titles and tight-context brand; its one real consumer is the tray's delete glyph (`×`). Dialog titles (`sheet-title`) and the pane heading (`pane-title`) both actually sit one step down at `--fs-2`. |
| `--fs-4` | 19px | compact stat | The optimisation delta figure and the day-nav's prev/next chevrons. |
| `--fs-5` | 23px | wordmark | The brand name; the mobile-breakpoint secondary total figure shares this size coincidentally. |
| `--fs-6` | 27px | secondary lead | The desktop miles and stop-count totals beside the lead figure. |
| `--fs-7` | 33px | mobile lead | The driving-total lead figure at ≤900px. |
| `--fs-8` | 39px | primary lead | The driving-total lead figure on desktop — the single largest number in the system. |

One text size lives outside this table: the Line's own drive-leg and slack labels are drawn at `11px` directly inline inside the SVG overlay (`schedule.js`), not declared in CSS, so they never surface in a CSS-level audit of the scale.

### Weight

Three weights carry real hierarchy: **400** for reading/meta text; **600** for interactive/UI text (buttons, station and siding names, search-result names); **700** for anything that leads — display figures, brand, and state-asserting badges (`Won't fit`, `Fixed`, `Conflict`).

Named exceptions, unchanged from the prior world and reverified: `.daynav-btn` stays 400 despite sitting at the `compact-stat` size (a navigation glyph, not data); `.daynav-date` stays 700 at `--fs-2` as the control's primary identifier; `.pane-title`/`.sheet-title` are `<h2>`/`<h3>` deliberately downgraded to 600 so a chrome label doesn't compete with figures/brand for 700's weight.

**Loaded but unused:** the Google Fonts request still pulls Archivo weight 500 (`Archivo:wght@400;500;600;700`), and no rule in `style.css` sets `font-weight: 500` anywhere — an unchanged, still-live cost from before the palette swap.

### Line Height

`--lh-tight` (.95) for the big hero figures; `--lh-label` (1.1) for short single-line UI text that never wraps; `--lh-read` (1.5) for anything that's actually prose. Two bare-literal exceptions survive outside the three roles: the paste textarea's `1.7` and the delete glyph's `1`.

### Named Rules
**The Named-Role Scale Rule.** Every font size is one of the eight `--fs-` tokens, documented by role. A new component reaches for a role, never a bare pixel value or a ninth size.

**The Weight Carries Hierarchy Rule.** 400/600/700 mean reading text / interactive text / a leading figure-or-brand-or-badge everywhere except the three named exceptions above.

**The Three Line-Heights Rule.** `--lh-tight`/`--lh-label`/`--lh-read` are the complete set; the two bare-literal exceptions are single-purpose optical fixes, not a fourth role.

## Layout

Unchanged from the prior world, reverified: desktop is a single fixed 100dvh, three-column CSS grid — `rail` (`--rail-w: 248px`) / `line` (`--line-w: clamp(340px, 30vw, 440px)`) / `map` (`1fr`) — with the tray docked under the Line column. `body { overflow: hidden }` means the page never scrolls; each pane owns its own internal scroll.

**Spacing is a real 4px grid.** `--space-1` through `--space-7` (4/8/12/16/20/24/32px); `--pad` (`--space-5`, 20px) and `--gap` (`--space-3`, 12px) are semantic aliases onto it, not standalone values. A handful of sub-4px literals survive on purpose as optical nudges (a badge's vertical padding, a baseline alignment), not spacing-rhythm values.

**Responsive breakpoints**, unchanged: **≤1180px** narrows the rail and Line columns; **≤900px** collapses to one column (`rail → line → map → tray`), re-enables page scroll, rotates every pane's `border-right` divider to `border-bottom`, and steps the totals down one type-scale role.

### Named Rules
**The 4px-Grid Rule.** Every meaningful gap, padding, and margin is one of the seven `--space-` steps or the `--pad`/`--gap` aliases.

**The One-Screen Rule.** Desktop never scrolls the page; only the panes scroll internally.

**The Read-Only Overlay Rule.** The Line's SVG track is absolutely positioned over FullCalendar's real grid and only ever reads geometry (`getBoundingClientRect`) — it never sets `position` on `.fc-v-event` or `info.el`, because FullCalendar sizes events by absolute top/bottom to keep them proportional to duration. Confirmed unchanged in the current `_draw()`.

## Elevation & Depth

Flat by material, not flat by accident, and the metaphor still holds under the new palette: `box-shadow` is not a real elevation device anywhere except one deliberate exception (below). Depth reads from a hairline border and which of four paper steps a surface sits on — `--paper-sink` (recessed: rail, tray, map background) is the darkest/most-toned step; `--paper` (ground) sits above it; `--paper-hover` (a lift) sits above that; `--paper-raise` (raised, true white) is the lightest. The physical logic is consistent with the enamel world even though the absolute direction inverted: a surface reads as "above" by moving *toward the light* — brighter/whiter here, where the enamel world's "above" moved toward the light by getting less dark.

A scheduled Line station now sits permanently on the raised (Paper Raise) step at rest, unlike a tray siding, which starts at ground level (`--paper`) and only lifts to Paper Raise on hover — a station is already committed to the day; a siding is not yet.

**The one exception, expanded.** In the prior enamel world, `box-shadow` existed for exactly one hack: faking a second concentric ring on a pinned map marker, because MapLibre markers can't produce that with a plain `border`. In the Paper Line, the exception is broader and more principled: `box-shadow` is used on **all three** parts of every marker — `.pin-tick` (`0 2px 6px rgba(20,24,20,.28)`), `.pin-stem` (`0 1px 3px rgba(20,24,20,.3)`), and `.pin-label` (`0 2px 6px rgba(20,24,20,.22)`) — regardless of state. The reason is structural, not a one-off fix: a marker floats over arbitrary, unpredictable tile colour and cannot separate from it by tonal step the way a card on the paper ground can, because there is no guaranteed paper ground underneath it. Every one of these shadows is an ink-strong-based rgba, not a token — `rgba(20,24,20, …)` is `--ink-strong` written out by hand at three different alphas, and is exempt from The Tokenised Derivative Rule for the same structural reason box-shadow itself is exempt from the no-shadow rule: it exists nowhere else to be consistent with.

### Named Rules
**The Flat-By-Material Rule.** Depth is tonal, not cast. A surface is "above" another by sitting a lighter step of the same paper plus a hairline border — never a shadow, never a blur — everywhere except the marker exception below.

**The Marker Shadow Exception.** `box-shadow` is permitted on `.pin-tick`, `.pin-stem`, and `.pin-label` alone, because a map marker sits over unpredictable tile colour and has no tonal ground to step against. It is not precedent for a shadow anywhere else in the system — every other surface has a real paper step to lean on instead.

## Shapes

**Radius is split, unchanged: chrome rounds, the diagram stays sharp.** `--radius-chrome` (5px) applies to: `.daynav`, `.delta`, `.btn` (every variant), `.rail-note`, `.pane-count`, `.search input`, `.search-results`, `.maplibregl-ctrl-attrib`, `.maplibregl-ctrl-group`, `.pin-label`, `dialog.sheet` and its `textarea`/`.field input`, `.siding`, and `.toast` — confirmed against the current stylesheet. It does **not** apply to `.fc-v-event` or anything inside `.line-pane`, the map's own route/track rendering, or `.pin-tick`/`.status-dot`/`.siding-tick` (already circular). Circles remain the system's only curve inside the diagram.

**The hairline hierarchy is two weights, not one.** `--hair` (1px) is the default: card borders, chip/badge outlines, minor rules. `--hair-wall` (2px) is reserved for the app's major structural walls — the rail/line-pane/tray panel dividers — because a system where every border is the same 1px, major walls included, reads as an undifferentiated ruled grid rather than a floor plan. The Line/Map seam goes one step further: it's conceptually the most important wall in the app (diagram vs. real cartography), so its colour overrides from `--rule` to the darker `--ink-dim`, on both the desktop `border-right` and the mobile `border-bottom` — the one wall in the system deliberately made stronger than the weight token alone would give it.

The rail and tray's ground texture is the same 45°/90° SVG hairline mesh from the prior world, tiled 168×168px, still composited in one shorthand with `var(--paper-sink)`. Its stroke (`#cfc7b3`) is baked directly into the data URI rather than tokenised — an SVG data URI can't reference a CSS custom property, so this one literal is structural, not drift.

### Named Rules
**Chrome Radius, Diagram Stays Sharp.** Tool chrome rounds at `--radius-chrome` (5px); the diagram and the map's own route/track rendering stay exactly `0`, with circles as their only curve.

**The Two Weights Rule.** `--hair` is the default border weight everywhere; `--hair-wall` is reserved for major structural panel dividers, and the Line/Map seam additionally overrides its colour to `--ink-dim` because it is the single most important boundary in the layout.

## Components

### Buttons
- **Shape:** `--radius-chrome` (5px), 1px border (transparent or coloured by variant), uniform `12px 16px` padding (`--space-3 --space-4`) across every variant.
- **Primary:** green fill, paper-raise label. Hover deepens to `--green-deep` (6.20:1) — never lightens. `:active` punches out: fill becomes paper, border and text become green-ink. While Optimise works (`.is-working`), the arrow icon loops a `depart` keyframe (900ms, infinite) — this is the one animation in the system that both loops *and* is tied to a real pending async call, not a decorative idle loop (see Motion System).
- **Ghost:** transparent, rule border, ink-mid label; hover brightens border and label to ink-strong.
- **Line:** transparent, green border, green-ink label at rest. Hover **and** `.is-ready` fill solid green with **ink-strong** text — not paper-raise. Measured, this pairing is **3.32:1**, under the system's own stated 4.5:1 AA floor (`PRODUCT.md`'s Accessibility & Inclusion section). This is recorded as an observed gap to fix, not a sanctioned exception; nothing in the direction contract asked for it, and it's the one button state in the system that doesn't clear the floor every other text/fill pairing does.
- **Danger:** clay-rim border (40%-alpha clay), clay-ink label, pinned to the far side of a sheet's action row; hover fills solid clay with paper-raise text (5.72:1).
- **Press feedback / disabled:** unchanged — `translateY(1px) scale(.99)` on `:active`; `opacity: .32` and no press transform when disabled.

### Chips / Badges
- **Style:** no fill, 1px `currentColor` border, `micro`/11px uppercase, weight 700 — unchanged shape from the prior world, recoloured.
- **Variants:** `.ev-badge--pin` (ink-strong, "Fixed") and `.ev-badge--unfit` (clay, "Won't fit" / "Conflict"). No badge for the flexible/green state — flexible is still the diagram's unmarked default.

### Cards / Containers — The Line's Stations
**Stations are cards again, and the reversal is deliberate and load-bearing.** In the enamel world, a station was explicitly "not a card" — transparent, borderless at rest, revealing a surface only on hover. In the Paper Line, `.fc-v-event` carries a real `background: var(--paper-raise)` and `border: var(--hair) solid var(--rule)` **at rest**. The code comment beside it says exactly why: *"the box just now has a real surface at rest instead of only revealing one on hover, which was the actual comprehension problem: an event with no background at all is indistinguishable from an empty grid row."* This is the same finding The Card Floor Rule exists to record, applied to the one component where it was most acute.

A stale comment survives directly above this rule — `/* A station, not a card. Ink block on the left edge, porcelain label. */` — describing the *previous* world's doctrine, unchanged since the palette swap. It contradicts the code beneath it and should be corrected, not treated as current guidance; it is flagged here rather than silently followed.

- **Hover / selection surface:** the old mechanism survives, layered on top of the now-permanent card: a `::before` spanning `inset: 0 0 0 -34px` (reaching back past the label to the tick) fills `--paper-hover`, animating from `opacity: 0` to `.85` on hover and `1` on `.is-selected` — these two figures are current, not the enamel world's `.62`/`.9`.
- **Multi-select:** `.is-multiselected` draws a `1.5px` outline in green-ink, offset `-1.5px`.
- **Hover border:** any hovered station's resting `--rule` border brightens to `--ink-mid`.
- **State moved off the border, unchanged principle:** `.is-unfit` recolours `.ev-name` clay; `.is-nogeo` recolours it ink-mid. A pinned stop carries no card-level styling of its own; "Fixed" reads from the badge and the Line's own ink-strong ring alone.
- **Coupling to record:** `LABEL_INSET` in `schedule.js` (`34`) must stay equal to `.fc-v-event`'s `margin-left` (`34px`); the SVG connector is drawn to `labelX − 3`. Unchanged, still load-bearing.
- **Sidings** (the tray's cards, `.siding`) sit at ground level (`--paper`) at rest — not the raised step a scheduled station now permanently occupies — and lift to `--paper-raise` only on hover. The distinction is the metaphor: a siding is not yet on the day; a scheduled station already is.
- **No left-edge accent.** Confirmed absent from the current stylesheet, same as before — colour lives on the Line and the route, not as a decorative flag on a container.

### Inputs / Fields
- **Style:** paper fill, hairline border, `--radius-chrome`, `--space-2`/`--space-3` padding, `ui-text`/13px.
- **Focus:** the border turns solid green — the same ink as `:focus-visible` everywhere else.
- **State note:** a helper line reports state in text colour — green for confirmed ("Located."), clay for failed ("Address not found.").

### Navigation
The Day Nav is unchanged in construction: a three-cell hairline grid (34px/1fr/34px), `overflow: hidden`-clipped to `--radius-chrome`, prev/next chevrons at `compact-stat` (19px, unweighted) in ink-mid turning ink-strong on a rule-coloured hover fill, flanking a centred date in Archivo Narrow 700/`ui-text` uppercase ink-strong. A separate "Today" pill sits beneath at `micro` (11px, ink-dim) and turns green-ink on hover.

### Maps Handoff
The single-button toggle (`#btnMapsAction`, `.btn--line.btn--wide`) is unchanged in behaviour from the prior world, recoloured: at rest it reads "Copy Maps link"; after a successful copy it relabels to "Open" and gains `.is-ready`, filling solid green with ink-strong text (see Buttons → Line, and its recorded contrast gap); a sequence change (not a same-order, time-only drag) reverts it automatically.

### Status & Feedback
- **Status line** (`.status`): a `micro`/11px uppercase ink-dim label beside a 7px dot — green for ready; clay, pulsing, for busy; clay, static, for error. Busy and error now share one ink where the prior world gave them separate colours (amber vs. scarlet); the pulse is the only thing that tells them apart, a direct consequence of dropping to two state inks.
- **Delta panel** (`.delta`): a `--radius-chrome`-rounded, hairline-bordered strip in a low-alpha tint of the result colour — green edge/wash for "less driving," clay edge/wash for "more driving" — holding a `compact-stat`/19px tabular figure and a `micro`/11px label.
- **Toasts:** paper-raise, ink-dim border by default, `--radius-chrome`-rounded, recoloured per kind — warn → clay border/text, error → clay border with clay-ink text, ok → green border with (see the recorded `--green-lift` gap under Colors → Named Rules) text that currently falls back to plain ink rather than a distinct green.

### The Line (signature)
The Line remains an SVG overlay (`#lineOverlay`) painted on top of FullCalendar's real time grid, redrawn on a `requestAnimationFrame` loop whenever the grid scrolls, resizes, hovers, or its data changes. What changed is what it draws.

- **Colours are read live, not hardcoded.** `_draw()` opens by pulling every ink it needs off `getComputedStyle(document.documentElement)`, with hex fallbacks matching the current tokens. This exists specifically so a future palette change can't repeat what happened to this file during the current one: literals silently pointing at a dead theme.
- **The track is drawn in weighted segments, not one continuous stroke.** For each station's occupied span (`st.y` to `st.yEnd`), a 7px round-capped green line marks "stopped here." Between stations, the gap is split proportionally: a 3px solid green segment for the drive (`driveMin / gapMin` of the pixel gap), then a 3px dashed (`2 4`) rule-coloured segment for whatever slack remains — only drawn once the pixel gap reaches 16px, coordinated with `.has-gap-tick` on the event so the CSS-side `.ev-drive` fallback never shows the same number twice.
- **The duration rides a chip on the driven stretch**, not a floating label: an 11px Archivo/700 green-ink text on a rounded (`rx 3`) paper-raise rect with a 1px rule stroke, centred on the driven segment's midpoint.
- **Slack, when there's room, gets its own label** — "N min free" in 11px ink-dim/400 — shown only when the slack is ≥10 minutes *and* the remaining pixel space is ≥22px.
- **Stations:** radius `(pinned ? 7.5 : 5) × (hot ? 1.34 : 1)`; ink is clay if unfit/conflict, else ink-strong if pinned, else green. A 3px-stroke ring on a paper-raise fill (a punched hole, not a solid marker); a flexible station additionally fills a solid core (`r`: 2, or 2.8 when hot) in the same ink. A conflict adds a struck cross at `k = r × 0.62`.
- **The tick-to-label connector has no dedicated colour token any more.** At rest it draws in `--rule` (read live, same as everything else); when the station is hovered or selected it thickens to `1.6px` and switches to the station's own ink. The prior world's bespoke `--connector` token doesn't exist in this palette — a genuine simplification, not an oversight.

### The Recoloured Basemap (signature)
`map.js` still refuses a stock tile set, but the source style changed from OpenFreeMap's `dark` to its `positron` (light) style, and the recolouring target moved from the enamel ramp to the paper one.

- **Ground/default:** mixes a warm greige (`#D9D3C3`) toward Paper by `clamp(L, 0, 1)` — "luminance now maps the other way round: dark source pixels become the darker paper tones, bright ones approach the paper itself" (verbatim comment).
- **Water:** mixes a soft sage (`#A8BEB6`) toward a dedicated water tone (`#C3D2CC`) by raw luminance.
- **Road:** mixes a warm taupe (`#B2AA97`) toward Paper by `clamp(L × 0.85, 0, 1)`.
- **Label:** mixes a deep tone (`#454E49` — the exact value of `--ink-mid`) toward a lighter grey-green (`#7A827C`) by raw, unclamped luminance, preserving the source style's own text-size hierarchy.
- **Halo:** flattened to plain Paper regardless of source luminance, so every label halo disappears into the ground.

Role detection is unchanged: any paint key containing `halo` → halo; any `symbol`-type layer → label; an id matching `water|waterway|ocean|river` → water; matching `highway|road|rail|aeroway|transit|bridge|tunnel` → road; else ground.

**The route** is three MapLibre layers, casing-then-ink, but the casing flipped from the enamel world's dark base to `dr-route-casing` at flat white (`#FFFFFF`, 7px→12px by zoom) — a light casing under a saturated ink is the correct construction on a light basemap, the mirror image of dark-under-bright on a dark one. `dr-route-ink` carries a gradient (both stops `#0E7A46`, used purely as the vehicle for the draw-on animation) for a real OSRM route; `dr-route-est` carries a flat, dashed (`[2, 1.6]`), 60%-opacity `#0E7A46` line for a straight-line estimate. The two are mutually exclusive, switched by `visibility`.

**These colours are literal strings, not CSS variables**, and that's structural rather than an oversight: MapLibre GL's paint properties are evaluated in a WebGL context and cannot consume `var()` at all, unlike `schedule.js`'s SVG overlay, which reads the live stylesheet. A future palette change must still hand-edit `map.js`'s `'#FFFFFF'`/`'#0E7A46'` literals (in three layer definitions plus `_drawOn()`'s gradient stops) in the same pass as `style.css` — the map is simply exempt from the *mechanism* schedule.js now uses, not from the *obligation* to stay in sync.

**Pins** are a 26px paper-raise circle badge on a 9px stem (`.pin-stem`, 2.5px wide), anchored `bottom` so the stem's tip sits on the real coordinate, holding the stop's sequence number. At rest the ring is a 2.5px green stroke; a fixed appointment thickens it to 3px ink-strong; a won't-fit stop recolours the ring and label clay-ink; a conflict fills the badge solid clay with a struck-cross cut from paper-raise (the same cross construction as the Line's own conflict mark); an active (focused) pin fills solid green with paper-raise text. Hover/`.is-hover` scales the badge ×1.18; `.is-active` scales it ×1.24 — both figures changed from the prior world's 1.4/1.28, because the marker itself was rebuilt (badge + stem + label) rather than merely recoloured. A `.pin-label` replaces the browser's native `title` tooltip with a styled box (paper-raise, rule border, `--radius-chrome`) that only appears on hover/active.

### Motion System

The five timing values and the split they encode are unchanged from the prior world: `--t-fast` (120ms) and `--t-base` (220ms) for ordinary state change on `--ease` (`cubic-bezier(.2, .7, .3, 1)`); `--t-move` (440ms) and `--ease-out` (`cubic-bezier(.16, 1, .3, 1)`) reserved for spatial motion — a reorder, a count-up, a route drawing itself on.

- **Reorder** (`captureRects()`/`playReorder()` in `schedule.js`): a FLIP transform per station, staggered 26ms and capped at 160ms total, hardcoded at 460ms (20ms over the `--t-move` token, since the Web Animations API call can't read the CSS custom property). Skipped under reduced motion.
- **Count-up** (`countTo()` in `app.js`): the delta figure counts from 0 over 620ms on a hand-rolled ease-out cubic. Writes the final value immediately under reduced motion.
- **Route draw-on** (`_drawOn()` in `map.js`): 720ms, the same ease-out-cubic shape, sweeping a `line-gradient` stop across `line-progress`. Jumps to the fully-drawn state under reduced motion.

**Looping animation is reserved for a real pending operation, not decoration.** Two loops exist in the current build: the busy status dot (`@keyframes pulse`, 1s) and the Optimise button's arrow while `.is-working` (`@keyframes depart`, 900ms). Both are tied to an actual in-flight async call and end when it resolves — neither is an idle-state screensaver. The system's now-line indicator stays a static clay dot rather than a pulsing one, which is the visible trace of a decorative loop that was tried there and rejected for competing with the Line's own focal moments; that rejection is the boundary a new looping animation should be checked against, not the count of loops currently running.

**Reduced motion**, unchanged: `@media (prefers-reduced-motion: reduce)` clamps every transition to 90ms and every animation to one iteration; `playReorder()`, `countTo()`, and `_drawOn()` each check it directly in JavaScript and take a static branch, since a FLIP `element.animate()` call and a `requestAnimationFrame` loop aren't reachable from a stylesheet override alone.

## Do's and Don'ts

### Do:
- **Do** treat 1.31:1 (Paper Raise on Paper) as a floor, not a target to erode — see The Card Floor Rule. A material change that brings a card and its ground closer together than this is reopening the exact defect this palette exists to fix.
- **Do** treat `--green-ink` (6.93:1) and `--clay-ink` (5.98:1) as the only legible way to set either line ink as small text; the raw values fail 4.5:1 on paper.
- **Do** read Line and legend colours from `getComputedStyle`, never hardcode a hex in `schedule.js` or `app.js`'s `renderLegend()` — this is exactly the discipline the last palette swap needed and didn't have.
- **Do** remember `map.js`'s route colours are literal strings, not CSS variables, and update them by hand alongside `style.css` on any future palette change — MapLibre's paint properties can't consume `var()`.
- **Do** round tool chrome at `--radius-chrome` (5px) and keep the diagram and the map's route/track at exactly `0`.
- **Do** reach for one of the eight named `--fs-` roles and one of the three `--lh-` line-heights, never a bare pixel value.
- **Do** draw every gap, padding, and margin from `--space-1`–`--space-7` (or the `--pad`/`--gap` aliases).
- **Do** use clay freely in chrome for anything that genuinely needs attention. The moment clay touches a station or a map pin, hold it to exactly one meaning: won't-fit or collision.
- **Do** keep the tick, connector, and card of a station acting as one coupled object — check `LABEL_INSET`/`margin-left` before changing any one of them independently.
- **Do** tokenise every derived alpha wash or hover fill the moment it's introduced, in the same pass as the primary it derives from.

### Don't:
- **Don't** add a coloured left-edge accent to a card or container — confirmed still absent, still an anti-pattern here.
- **Don't** add a shadow or a gradient anywhere except the map marker's three parts (`.pin-tick`/`.pin-stem`/`.pin-label`); every other surface has a paper tonal step to lean on instead.
- **Don't** let clay mark a routine drive leg or a routine (non-unfit) station/pin state.
- **Don't** invert `.maplibregl-ctrl-group button span`'s filter. That convention only made sense against the enamel world's dark control glyphs; inverting it on paper renders the zoom buttons white-on-white and they disappear.
- **Don't** invent a third hue for the Line or the map. Green, clay, and ink-strong are the complete set.
- **Don't** add a decorative, idle-state loop. Looping animation is reserved for feedback tied to a genuinely pending operation (busy status, an in-flight Optimise) — a pulsing now-line dot was tried and rejected for exactly this reason, and the static clay dot that replaced it is the standing evidence.
- **Don't** give a station its own left-border or full-recolour treatment for state; state lives on `.ev-name`'s text colour and the badge, never a card-level border swap.
- **Don't** trust the `/* A station, not a card. */` comment above `.fc-v-event` — it describes the previous world's doctrine and was not updated when the rule beneath it started giving every station a real paper-raise/rule surface at rest. Read the code, not the comment.
- **Don't** treat `.btn--line`'s hover/`.is-ready` state (ink-strong text on green, 3.32:1) as a model to copy elsewhere — it's a recorded gap under this system's own 4.5:1 floor, not a sanctioned pairing.
