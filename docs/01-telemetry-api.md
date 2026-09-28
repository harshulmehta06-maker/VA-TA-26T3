# Milestone 1: Understanding the telemetry API

## Follow one reading

1. `emulator-client.ts` requests `/sensors` and opens the emulator WebSocket.
2. A message arrives as text, not a trusted TypeScript object.
3. `telemetry.ts` parses JSON and checks the exact keys, numeric types, finite numbers, positive timestamp, safe integer ID, and membership in the metadata.
4. Old or duplicate timestamps cannot replace a newer reading.
5. The API checks the inclusive sensor range and counts out-of-range events per sensor using API receipt time.
6. A Map stores the latest accepted reading under its sensor ID.
7. `app.ts` returns a snapshot when a browser requests `/telemetry/latest`.

## Why these decisions?

- **Metadata versus readings:** names and units rarely change; values change constantly. Fetch metadata once and poll readings every second.
- **Validation at the boundary:** TypeScript only checks our code at compile time. It cannot guarantee that external JSON is valid.
- **Strict rejection:** numeric strings and extra fields are discarded rather than silently repaired. This is a documented choice allowed by the assessment.
- **Malformed versus out of range:** a string in `value` is malformed. A numeric battery temperature of 90 C is meaningful but outside the permitted 20–80 C range. Keep the latter visible.
- **Per-sensor windows:** three tyre events plus one battery event must never become one four-event alarm.
- **Bounded event storage:** keeping the four most recent out-of-range receipt times is sufficient to ask whether at least four exist in the last five seconds. Log on every further out-of-range reading while the threshold holds.
- **Half-open interval:** the window is `(now - 5000, now]`; an event exactly five seconds old expires.
- **Time units:** source `timestamp` is Unix seconds. `receivedAt` and `generatedAt` are Unix milliseconds. Multiply source timestamps by 1000 for JavaScript Date.
- **Missing versus zero:** null means no accepted reading. Zero is a real measurement and must not mean missing.
- **Stale versus disconnected:** each reading becomes stale after five seconds without a valid update. The separate connected flag describes the upstream socket. A socket can be connected while one sensor has stopped producing valid data.
- **Recovery:** failed metadata requests and closed sockets retry with delays from one to thirty seconds. Ping/pong detects an unresponsive socket. Cached readings remain visible but become stale.
- **Memory only:** restarting the API clears readings and counters. History and persistence are not implemented in this milestone.

## Try it

From the repository root:

```sh
npm ci --prefix api
npm test --prefix api
docker compose up --build -d api emulator
curl http://localhost:4000/health
curl http://localhost:4000/sensors
curl http://localhost:4000/telemetry/latest
docker compose logs -f api
```

Stop the emulator, inspect health and stale readings, then start it again:

```sh
docker compose stop emulator
# Wait more than five seconds, then inspect health and telemetry.
docker compose start emulator
# Recovery may take up to the current retry delay (maximum 30 seconds), plus handshake time.
```

## Explain it in an interview

“The emulator is stateless, so my API maintains the latest validated reading per sensor. Metadata is fetched separately. I reject malformed messages, preserve out-of-range values for diagnosis, and use independent sliding windows to log repeated range violations. Disconnects trigger retries, and the UI can distinguish missing, stale, and current readings.”

Questions to answer yourself:

1. Why is a TypeScript interface insufficient validation?
2. Why does 90 C remain visible while the string '90' is rejected?
3. What happens to the latest value after invalid data arrives?
4. Why does the fourth event trigger the log, rather than the third?
5. What information is lost when the API restarts?
