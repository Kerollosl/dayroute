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

**No Texture.** Zero `data:image/svg+xml` background fills. Depth is shadow;
ground is flat colour.

**The Card Stripe Ban.** Event cards carry no coloured left edge. The track beside
them already colours state (accent = flexible, `--text` = fixed, `--danger` =
won't-fit) and the badge names it; a stripe repeated the same fact a third time and
tripped the `side-tab` detector honestly.

**FullCalendar sizing.** Never set `position` on `.fc-v-event` / `info.el` — FC
sizes events by absolute top/bottom and overriding it makes them grow to fit text.
`LABEL_INSET` in `schedule.js` must equal `.fc-v-event`'s `margin-left` (30px).

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

Below 900px the grid stacks `rail / line / map` and the page owns the only scroll.

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

## Copy

Plain words, sentence case, US spelling. "Schedule", not "The Line". "Unscheduled",
not "Sidings". "Optimize", "Copy link", "Open in Maps", "Paste a list", "Time here".
No taglines in-app. Never `innerHTML` a stop name — names come from pasted lists and
geocoder responses; every renderer uses `textContent`.
