const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TelemetryStore, parseSensors, ranges } = require('../dist/telemetry');
const { createApp } = require('../dist/app');
const sensors = parseSensors([{sensorId: 1, sensorName: 'BATTERY_TEMPERATURE', unit: 'C'}, {sensorId: 2, sensorName: 'VEHICLE_SPEED', unit: 'km/h'}]);
const raw = (value, timestamp, sensorId = 1) => JSON.stringify({sensorId, value, timestamp});

test('rejects malformed messages without replacing the latest valid reading', () => {
  const store = new TelemetryStore(); store.setSensors(sensors); store.ingest(raw(30, 1));
  for (const message of ['{', 'null', '[]', raw('30', 2), raw(30, '2'), raw(30, 2, 999), raw(30, 2, '1'), '{"sensorId":1,"value":1e999,"timestamp":2}', '{"sensorId":1,"value":30,"timestamp":2,"extra":true}', '{"value":30,"timestamp":2}', raw(30, 0)]) {
    assert.equal(store.ingest(message), false, message);
  }
  assert.equal(store.snapshot()[0].value, 30);
  assert.equal(store.counters.rejected, 11);
});
test('all assessment range boundaries are inclusive', () => {
  for (const [sensorName, [min, max]] of Object.entries(ranges)) {
    const store = new TelemetryStore(() => 1000, () => {});
    store.setSensors(parseSensors([{sensorId: 1, sensorName, unit: 'unit'}]));
    for (const [i, value] of [min, max, min - 1, max + 1].entries()) {
      store.ingest(raw(value, i + 1));
      assert.equal(store.snapshot()[0].status, i < 2 ? 'normal' : 'out_of_range');
    }
  }
});
test('four events trigger, windows expire, and sensors are independent', () => {
  let now = 10000; const logs = [];
  const store = new TelemetryStore(() => now, line => logs.push(line)); store.setSensors(sensors);
  for (let t = 1; t <= 3; t++) store.ingest(raw(90, t));
  store.ingest(raw(300, 1, 2)); assert.equal(logs.length, 0);
  store.ingest(raw(90, 4)); assert.equal(logs.length, 1);
  assert.match(logs[0], /1970-01-01T00:00:10.000Z.*BATTERY_TEMPERATURE \(1\)/);
  now += 5000; store.ingest(raw(90, 5)); assert.equal(logs.length, 1);
});
test('missing, stale, and out-of-order data cannot masquerade as current data', () => {
  let now = 10000; const store = new TelemetryStore(() => now); store.setSensors(sensors);
  assert.equal(store.snapshot()[0].status, 'missing');
  assert.equal(store.snapshot()[0].value, null);
  store.ingest(raw(30, 10)); assert.equal(store.ingest(raw(80, 9)), false);
  assert.equal(store.ingest(raw(80, 10)), false);
  now += 5001; assert.equal(store.snapshot()[0].status, 'stale');
  assert.equal(store.snapshot()[0].value, 30);
});
test('metadata rejects duplicates and unsupported sensors', () => {
  assert.throws(() => parseSensors([]));
  assert.throws(() => parseSensors([...sensors, sensors[0]]));
  assert.throws(() => parseSensors([{sensorId: 1, sensorName: 'UNKNOWN', unit: 'x'}]));
});
test('HTTP readiness, metadata, latest envelope, and errors', async () => {
  const store = new TelemetryStore(); const upstream = {connected: false};
  const server = createApp(store, upstream).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/health')).status, 503);
    assert.equal((await fetch(base + '/sensors')).status, 503);
    store.setSensors(sensors); upstream.connected = true; store.ingest(raw(30, 1));
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await (await fetch(base + '/sensors')).json()).length, 2);
    const res = await fetch(base + '/telemetry/latest');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json(); assert.equal(body.readings[0].value, 30); assert.equal(body.source, 'emulator');
    assert.equal((await fetch(base + '/openapi.yaml')).status, 200);
    assert.equal((await fetch(base + '/unknown')).status, 404);
    upstream.connected = false;
    const diagnostics = await fetch(base + '/diagnostics');
    assert.equal(diagnostics.status, 200);
    assert.equal(diagnostics.headers.get('cache-control'), 'no-store');
    const quality = await diagnostics.json();
    assert.equal(quality.connected, false);
    assert.equal(quality.counters.accepted, 1);
    assert.deepEqual(quality.incidents, []);
    assert.equal(typeof quality.startedAt, 'number');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('incidents preserve evidence, avoid continuous duplicates, and retrigger after expiry', () => {
  let now = 10000;
  const store = new TelemetryStore(() => now, () => {}); store.setSensors(sensors);
  for (let t = 1; t <= 3; t++) store.ingest(raw(90, t));
  assert.equal(store.diagnostics().incidents.length, 0);
  store.ingest(raw(90, 4)); store.ingest(raw(95, 5));
  let incidents = store.diagnostics().incidents;
  assert.equal(incidents.length, 1);
  assert.deepEqual(incidents[0].readings.map(r => r.timestamp), [1,2,3,4]);
  assert.equal(incidents[0].sensorId, 1);
  now += 5001;
  for (let t = 6; t <= 9; t++) store.ingest(raw(100, t));
  assert.equal(store.diagnostics().incidents.length, 2);
  assert.equal(store.diagnostics().incidents[0].id, 2);
});

test('incident storage remains bounded and malformed readings never trigger incidents', () => {
  let now = 10000; let timestamp = 0;
  const store = new TelemetryStore(() => now, () => {}); store.setSensors(sensors);
  for (let i = 0; i < 105; i++) {
    now += 6000;
    for (let j = 0; j < 4; j++) store.ingest(raw(100, ++timestamp));
  }
  const before = store.diagnostics().incidents;
  assert.equal(before.length, 100); assert.equal(before[0].id, 105);
  for (let j = 0; j < 4; j++) store.ingest(raw('100', ++timestamp));
  assert.deepEqual(store.diagnostics().incidents, before);
});
