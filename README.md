# dayroute

A day of stops read as a rail line, routed for least driving, handed to Google Maps.

Not a view onto your calendar. You build the day here — an agnostic schedule — and
the tool works out the cheapest order to drive it.

## The idea

**Fixed-time stops are anchors, not waypoints.** A dentist at 09:00 cannot be
reordered; a Costco run can. Every stop is either *fixed* (a real clock time) or
*flexible* (a duration). Optimise reorders only the flexible ones, fitting them
into the gaps between appointments, and reports any that will not fit rather than
dropping them.

## Running it

```bash
python3 -m http.server 8754      # then open http://localhost:8754
```

No build step, no install, no API keys, no account. State lives in `localStorage`.

## Services

All keyless, all courtesy endpoints — please keep usage personal.

| Need | Service |
|---|---|
| Tiles | [OpenFreeMap](https://openfreemap.org) `dark`, recoloured client-side |
| Place search | [Photon](https://photon.komoot.io) |
| Address fallback | [Nominatim](https://nominatim.openstreetmap.org) |
| Matrix + route | [OSRM](https://project-osrm.org) public server |

Geocoding results are cached permanently in the browser; the driving matrix is
cached per coordinate set, so reordering never re-fetches.

## Known ceilings

- Google Maps links take **9 waypoints** (11 stops). Longer days split into chained legs.
- **Mobile browsers honour only 3** waypoints; the Google Maps app takes all of them.
- OSRM's public server is best-effort and rate-limited. If it is unreachable the day
  still computes from straight-line estimates, drawn dashed and marked as estimates.

## Keys

`O` optimise · `/` search · `[` `]` previous/next day · `⌘Z` undo

## Deploying

GitHub Pages serves the repo root as-is — there is nothing to build.

```bash
git add -A && git commit -m "dayroute"
git push -u origin main
# then: Settings → Pages → Source: main / (root)
```

On the phone, open the Pages URL and add it to the home screen.
