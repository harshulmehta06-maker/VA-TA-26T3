# Dashboard review — 28 September 2026

## Fixes

- Health UI distinguishes a reachable but degraded API (emulator disconnected) from an unreachable API. A 503 degraded health response no longer produces a false network-failure card.
- The sensor table has its own keyboard-focusable horizontal scrolling region, keeping diagnostics within the viewport on narrow screens.

## Verified

- All eight API tests passed locally via npm test --prefix api: strict payload validation, inclusive sensor ranges, per-sensor five-second windows, stale and ordering rules, metadata validation, HTTP contracts, incident evidence, retriggering and bounded storage.
- Frontend production build and type checks passed.
- Stopping the emulator changed retained instruments and table readings to stale. The corrected header reported emulator disconnected. Restarting the emulator restored readings automatically. Emulator is running again.
- Sensor dropdown switched to pack voltage with V units and matching graph.
- Expanded battery-temperature graph opened; Escape dismissed it.
- Incident inspection displayed four preserved samples with source and receipt timestamps.
- No page-level horizontal overflow at the inspected 625px viewport. Wide sensor table scrolls within its own region.
- Browser error log returned no JavaScript errors during review.

## Remaining limitations / submission item

- Follow-up: the low-fidelity Figma mockup is now created; its viewable link and layout rationale are in justification.md.
- Browser history is sampled and resets on refresh; API history and incidents are in memory.
- This is a targeted review, not exhaustive browser/device or accessibility certification.
- API production Docker image omits test files. Run the documented test command from the repository, not inside the production container.
