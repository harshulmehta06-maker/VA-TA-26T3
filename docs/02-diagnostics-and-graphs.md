# Expandable graphs, data quality, and incidents

## What changed

The original page remains intact. The existing sensor table now has Expand buttons. A data-quality panel and incident timeline are appended beneath the table.

## Follow the data

1. Every emulator message reaches TelemetryStore, where validation and range checks occur.
2. Valid out-of-range samples enter a per-sensor five-second receipt-time window.
3. Crossing from fewer than four events to at least four creates an incident containing the four samples. Continuous violations keep logging, but do not repeatedly create the same incident.
4. GET /diagnostics returns counters and up to 100 incidents. The browser requests this every two seconds, independently of sensor polling.
5. Selecting an incident displays its stored evidence. It does not rely on whatever samples the browser happened to poll.

## Why not detect incidents in React?

The browser polls latest values about once per second. The emulator can emit several readings during that second. A frontend detector would miss events and could disagree with the required backend alert. The API receives the full stream, so it owns incident detection.

## What do the counters mean?

Accepted: valid, known, newer readings retained by the API.
Malformed rejected: wrong shape/type/ID or invalid numeric fields.
Old / duplicate ignored: otherwise valid readings that cannot replace a newer timestamp.
Out-of-range accepted: accepted readings outside the assessment range; this is a subset of accepted, not an additional category to sum.

## Graph expansion

The same SensorGraph component renders inline and in a larger native dialog. It continues to receive live history from the sensor table. React controls the selected sensor; the browser's dialog handles modal focus and Escape. Hovering selects the nearest sample on a real time axis. History remains sampled and browser-local; expanding a graph does not fabricate older readings.

## Tests and limitations

Automated tests verify the fourth-event trigger, preserved evidence, suppression of continuous duplicates, retrigger after expiry, bounded retention, and exclusion of malformed readings. Original API tests remain in place.

There is no database: restart clears incidents and counters. Refresh clears graph history. Figma is still a separate required deliverable. Nothing here is a prediction or diagnosis of a real vehicle fault; these are emulator range violations.

## Primary metrics and overview graph

The old instruction card is replaced by Vehicle Speed, Battery Temperature, and State of Charge, followed by a larger selectable graph. TelemetryProvider owns the existing polling loop and browser history; the overview and sensor table consume the same context. This avoids duplicated requests and guarantees both views use the same snapshot. The dropdown selects any of the 12 sensors without resetting its collected history. Missing values display a dash; retained stale values are labelled.


## Range colours on every graph

Every graph receives the sensor minimum and maximum from API metadata. Values within those inclusive limits are green; values outside them are red. These colours describe validity, not whether a reading increased or decreased.

The shared SensorGraph component uses an SVG vertical gradient with hard stops at the valid-range boundaries. A line crossing a boundary therefore changes colour at that value. Single readings use the same inclusive range comparison. Each graph gets its own gradient ID so the overview, table and expanded dialog cannot accidentally share thresholds.

The line joins sampled readings for visual context; it does not prove what happened between samples. Backend incidents still use actual received readings, independently of the browser graph.


## Speed dial and brake pressure

DrivingInstrument reads the same shared telemetry as the graphs. The segmented speed arc and front brake pressure ring use sensor metadata limits. Their fill is clamped to the display range, but the numeric value remains unchanged so an outlier is not concealed. Missing readings show a dash; stale readings are muted. These instruments use speed and pressure directly, with no invented gear or throttle. The brake disc is a static illustration; its surrounding ring represents hydraulic pressure in bar, not pedal position or disc rotation.


The battery thermometer maps the metadata minimum and maximum to its liquid column. The charge icon fills ten segments continuously on a physical 0–100% scale. Both retain exact numeric readings, show missing values as dashes, and mute stale data. Out-of-range readings change colour without hiding their actual values. All instruments share the same polling provider.


## Steering and tyre instruments

The steering illustration rotates directly by the received STEERING_ANGLE value in degrees, with zero at the top. It is a sensor-angle illustration, not a steering-ratio or road-wheel model. The tyre diagram maps FL/FR to the front and RL/RR to the rear, showing each pressure and its independent status. Missing values show dashes, stale data is muted, and out-of-range readings remain visible. These views reuse the telemetry provider without extra polling.
