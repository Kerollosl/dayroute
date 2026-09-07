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

Successful geocoding results are cached in the browser; failed lookups remain
retryable. The driving matrix is cached per coordinate set and simultaneous
requests share the same work, so reordering never re-fetches.

## Using the day

- **Add stop** creates a draft. Save a name/address, arrival time and visit length;
  Cancel or Escape leaves the day untouched. Clear the time to keep a stop unscheduled.
- Choose a date directly or use the day arrows. On phones, switch between
  **Schedule**, **Map** and **Places** without scrolling through the entire day.
- Search or paste places into Unscheduled. Open one to edit it, or use **+** to
  place it in the first available clock gap. Drive time is checked once located.
- **Optimize** moves only flexible stops. Fixed clocks and unfit stops stay unchanged.
  Use **Undo** to reverse the operation.
- A single destination works with or without a saved starting point. Longer
  days open a directions sheet with every leg available individually.

## Known ceilings

- Maps links use at most **3 intermediate waypoints** (5 locations per leg),
  including on desktop, so copied links also work in phone browsers. Consecutive
  legs share an endpoint; open each in order.
- OSRM's public server is best-effort and rate-limited. If it is unreachable the day
  still computes from straight-line estimates, drawn dashed and marked as estimates.
- **Retry routing** requests fresh road data after an outage. Drive times are not
  live traffic predictions; check Maps before leaving.
- Scheduling is local to this browser, not synced between devices. A Maps link
  shares directions, not an editable Dayroute schedule. Visit lengths are 5–720
  minutes; optimization uses a 20:00 end-of-day bound.

## Verification

```bash
node --test tests/core.test.mjs
```

The dependency-free regression suite covers routing failures/timeouts, cache
deduplication, origin and fixed-time constraints, overlapping appointments,
geocoding recovery, local-storage failure and mobile-safe Maps handoff.

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
