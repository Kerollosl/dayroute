# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site, ES modules, no bundler, no build step. Deployed to GitHub Pages; local dev via `python3 -m http.server`. User's explicit choice over a single self-contained HTML file, made to get a real URL that works on the phone.

Third-party runtime deps, all CDN, all keyless: FullCalendar 6.1.10 (grid), MapLibre GL (map). Network services, all verified to send `Access-Control-Allow-Origin: *`: OpenFreeMap `liberty` (tiles), Photon (place search), Nominatim (address fallback), OSRM public (`/table` matrix, `/route` polyline).

## Users

One person planning their own day of driving. Two devices, two moments: they build the schedule sitting at a laptop — morning coffee, or the night before — and they consume the result on a phone, in a car, about to pull out. The task is functional and repeated, not exploratory. Nobody else sees the schedule.

## Product Purpose

Turn a day's worth of stops into an ordered, minimal-driving route and hand it to Google Maps in one action.

The schedule is **agnostic and self-authored**. It deliberately does not read the user's Google Calendar: this is a scratch pad for a day of driving, not a view onto existing commitments. Success is the gap between "here are my stops" and "I'm driving with directions loaded" measured in under two minutes.

## Positioning

**Fixed-time stops are anchors, not waypoints.**

A plain travelling-salesman optimizer treats every stop as reorderable, which is wrong the moment one of them is an appointment. Here each stop is either *pinned* (a real start time — a dentist at 9:00) or *flexible* (a duration, no fixed time — a Costco run). Optimization reorders only the flexible stops, fitting them into the gaps between the pinned ones and rejecting any that cannot fit.

"Minimal driving" therefore means: given the appointments you cannot move, sequence the errands you can. Trip planners optimize whole itineraries; calendars respect fixed times; this does both at once.

## Operating Context

- **Plan on desktop, drive on mobile.** The output is a Google Maps URL, so the last step always leaves the product.
- Stops arrive three ways: typed in directly, pasted as a list or CSV of names and addresses, or found by name through place search.
- The unit of work is **one day**. Multi-day trips are out of scope.
- The schedule persists locally and privately. No account, no server, no sync, nothing leaves the browser except keyless geocoding and routing lookups.

## Capabilities and Constraints

**Does:** day grid with drag-to-move and resize; pinned vs. flexible stops; place search and paste-a-list import; live map with numbered stops and the road-following route; constrained route optimization; drive time and distance per leg and per day; copy or open a Google Maps link.

**Hard external limits, all to be surfaced in the UI rather than silently absorbed:**
- Google Maps URLs accept **9 waypoints** (11 stops per link). Longer days split into chained legs.
- **Mobile browsers honor only 3 waypoints** — and mobile is where the link gets used.
- OSRM's public server and the Photon/Nominatim endpoints are best-effort and rate-limited to roughly 1 request/second. Non-commercial use only.
- Free geocoders are weaker than Google on vague place names.

**Constraints:** no API keys, no billing account, no server, no build step. A Google Maps key must remain a drop-in upgrade behind a provider interface, never a requirement.

**Undecided:** the repo name `dayroute` is a working placeholder.

## Evidence on Hand

- `Github-Repos/gcal-plus/` — the user's own deployed Apps Script calendar tool. Code donor for the FullCalendar configuration, its debugged CSS overrides, multi-select batch drag, and the pack-back-to-back logic. Not a host; this product shares no runtime with it.
- `Chrome Extensions/vacation-map-plotter/index.html` — the user's CSV → geocode → pin → sidebar-sync loop. Shape is reusable; two known bugs in it are not.
- `Not on Github/beli-restaurants/all_restaurants.csv` — 216 real rows of Name + Address, and `dmv_places.csv` — 103 more. Real test material for the paste-a-list path. Neither has coordinates.
- No brand assets, no logo, no existing visual identity, no prior copy. Nothing to preserve.

## Product Principles

1. **Fixed time is a fact, not a preference.** Nothing the optimizer does may move a pinned stop.
2. **Never silently drop a stop.** A stop that will not fit its gap is shown as not fitting.
3. **The drag loop never waits on the network.** Reordering recomputes from a cached matrix; only redraws are debounced.
4. **Every external ceiling is stated where it bites,** at the moment it applies, in the user's terms.
5. **Keyless by construction.** A paid provider may improve the product; it may never be required to run it.

## Accessibility & Inclusion

No product-specific requirement established beyond meeting WCAG AA contrast and full keyboard operation of the schedule. Worth noting the physical scene: this is read in a hurry, sometimes in daylight glare, sometimes one-handed.
