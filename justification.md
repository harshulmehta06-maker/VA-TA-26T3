# Redback Telemetry Explorer — implementation decisions

## API (implemented)

The API fetches static metadata from the unmodified emulator and consumes its WebSocket stream. HTTP routes expose metadata separately from dynamic snapshots:

- `GET /health`: 200 while the upstream WebSocket is connected; 503 during startup/disconnection. Includes accepted, rejected, out-of-order, and out-of-range counters.
- `GET /sensors`: sensorId, sensorName, unit, and API-owned min/max ranges from the assessment table. Returns 503 before metadata is available.
- `GET /telemetry/latest`: emulator source label, connectivity, generation time, and one row per sensor. Values and timestamps are null before the first accepted sample. Responses use Cache-Control: no-store.
- `GET /openapi.yaml`: specification for the implemented routes. Import this into an OpenAPI viewer. `api/openapi.yaml` is canonical; the root copy is kept identical.

Clients should fetch metadata at startup and poll latest readings every second. A missing reading is different from a zero. Stale means no accepted reading has arrived for more than five seconds; out_of_range describes fresh numeric values outside the inclusive limits. Connection state is separate from per-sensor freshness.

### Validation and invalid data

Require exactly sensorId, value, timestamp. Reject malformed JSON, arrays, missing/extra fields, strings in numeric fields, nonfinite numbers, unsafe or unknown IDs, and nonpositive timestamps. Do not coerce numeric strings. Count rejected messages without logging every malformed payload. Older or duplicate source timestamps are counted separately and cannot replace a newer sample.

### Range monitoring

Map names to the assessment's valid ranges inside the API. Preserve correctly shaped out-of-range readings. Track each sensor independently over the receipt-time interval (now - 5000 ms, now]. The fourth out-of-range event triggers a console error containing ISO timestamp, sensor name, and ID; subsequent events also log while the condition holds. Retaining only the last four event times is enough to evaluate the threshold and bounds memory.

### Recovery and limitations

Fetch timeouts and a WebSocket handshake timeout prevent indefinite startup waits. Retry with capped exponential backoff; ping/pong detects unresponsive sockets. Graceful shutdown clears timers and closes the connection. Metadata and latest values are in-memory; no database, historical endpoint, or client streaming is implemented yet. Cached data remains available through outages. Health reports transport connectivity, not a guarantee that every sensor is fresh. Source timestamps are seconds; API receipt/generation times are milliseconds.

### Verification

Run `npm test --prefix api`. Tests exercise invalid payloads, inclusive limits for all sensors, independent windows and expiry, missing/stale/out-of-order states, metadata rejection, and HTTP readiness/error contracts. Docker integration checks supplement these with actual emulator traffic and outage/recovery.

The emulator source and configuration remain unchanged. API dependency versions are locked and Docker uses npm ci.

## Frontend (implemented)

The original assessment branding and palette are preserved. At the user’s request, the starter instruction card is replaced by three primary metrics (speed, battery temperature, state of charge) and a larger graph with a 12-sensor dropdown. A shared TelemetryProvider supplies both the overview and table from one polling loop and history buffer. All 12 sensors appear in the All sensors table with metadata, formatted values, units, source timestamps, and explicit missing/stale/range states. The existing shadcn-style Card components remain in the original layout.

The browser fetches metadata separately, polls latest readings sequentially, and retains a bounded 60-second sampled history per sensor. Duplicate timestamps do not create extra samples. Each row has a trend graph; an Expand button opens a larger native modal dialog with focus containment, Escape dismissal, and a close button. Pointer inspection exposes a sample value and timestamp. Histories reset on refresh and do not capture every emulator event. Gaps over five seconds are not connected by graph lines.

A data-quality panel polls /diagnostics every two seconds and shows accepted, malformed, old/duplicate, and out-of-range counts. Out-of-range counts overlap with accepted counts. Last-update time and error text identify retained/stale diagnostics.

The incident timeline is generated in the API rather than inferred from frontend polling. A threshold crossing creates one immutable record containing four triggering samples. Continuing breaches still generate the required console log, but do not flood the timeline with duplicate incidents. Once the count falls below four, a new crossing can create another incident. The latest 100 incidents are retained in memory, newest first. Selecting one displays its range and exact source/receipt times and values. API restart clears incidents/counters; the frontend clears its selected incident when the startup identifier changes.

### Instrument layout and engineer workflow

Six instrument panels prioritise current vehicle state: speed, battery temperature, state of charge, front brake pressure, steering angle, and four tyre pressures. The speed arc, thermometer and battery fill let an engineer scan readings quickly; numeric values and units remain visible for precision. The brake ring represents hydraulic pressure, not pedal travel. Steering rotates by the measured sensor angle without inferring a road-wheel ratio. The tyre diagram places FL/FR at the front and RL/RR at the rear to make pressure issues easy to locate.

An engineer first checks connectivity and current values, selects a sensor to inspect its recent trend, then uses the full table for individual readings. Data-quality counters distinguish rejected malformed messages from accepted range violations. Incident evidence answers which four readings triggered an alert. Missing and stale states are labelled explicitly; colour is supplemented by text. The responsive layout stacks instruments on narrow screens and scrolls the wide sensor table separately.

### Low-fidelity mockup

An editable SVG wireframe is included at `docs/redback-dashboard-wireframe.svg`. It documents the implemented desktop layout retrospectively, using neutral boxes and placeholder readings. The wireframe has been imported into Figma as editable layers. [View the low-fidelity Figma mockup](https://www.figma.com/design/0Z9YKBW9mPoSxwJmfWlx2t?node-id=1-2). Sharing is set to anyone with the link can view. It covers the six instrument panels, selected-sensor history, all-sensors table, data-quality counters and incident evidence. The layout rationale is documented above and on the canvas.

The 3D concept was dropped from scope.

## Learning notes

See `docs/01-telemetry-api.md` for the data flow, trade-offs, runnable experiments, and interview questions.
