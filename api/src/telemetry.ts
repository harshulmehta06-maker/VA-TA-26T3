export interface Sensor { sensorId: number; sensorName: string; unit: string; min: number; max: number }
export interface Reading { sensorId: number; value: number; timestamp: number }

// Assessment ranges, owned by the API; the emulator remains unchanged.
export const ranges: Record<string, readonly [number, number]> = {
  BATTERY_TEMPERATURE: [20, 80], MOTOR_TEMPERATURE: [30, 120],
  TYRE_PRESSURE_FL: [150, 250], TYRE_PRESSURE_FR: [150, 250],
  TYRE_PRESSURE_RL: [150, 250], TYRE_PRESSURE_RR: [150, 250],
  PACK_CURRENT: [-300, 300], PACK_VOLTAGE: [350, 500], PACK_SOC: [0, 100],
  VEHICLE_SPEED: [0, 250], STEERING_ANGLE: [-180, 180], BRAKE_PRESSURE_FRONT: [0, 120]
};

export function parseSensors(input: unknown): Sensor[] {
  if (!Array.isArray(input) || !input.length) throw new Error('Invalid metadata');
  const ids = new Set<number>();
  return input.map(s => {
    if (!s || !Number.isSafeInteger(s.sensorId) || s.sensorId <= 0 ||
        typeof s.sensorName !== 'string' || typeof s.unit !== 'string' ||
        !Object.prototype.hasOwnProperty.call(ranges, s.sensorName) || ids.has(s.sensorId)) {
      throw new Error('Invalid sensor metadata');
    }
    ids.add(s.sensorId);
    const [min, max] = ranges[s.sensorName];
    return { sensorId: s.sensorId, sensorName: s.sensorName, unit: s.unit, min, max };
  });
}

export class TelemetryStore {
  sensors: Sensor[] = [];
  private latest = new Map<number, Reading & { receivedAt: number }>();
  private incidents: Array<{ id: number; sensorId: number; sensorName: string; unit: string; min: number; max: number; detectedAt: number; readings: Array<Reading & { receivedAt: number }> }> = [];
  private evidence = new Map<number, Array<Reading & { receivedAt: number }>>();
  private sequence = 0;
  diagnostics() { return { counters: { ...this.counters }, incidents: [...this.incidents].reverse() }; }
  private events = new Map<number, number[]>();
  counters = { accepted: 0, rejected: 0, outOfOrder: 0, outOfRange: 0 };
  constructor(private clock = Date.now, private log: (message: string) => void = console.error) {}
  setSensors(sensors: Sensor[]) { this.sensors = sensors; }
  ingest(raw: string): boolean {
    let r: Reading;
    try { r = JSON.parse(raw); } catch { this.counters.rejected++; return false; }
    if (!r || typeof r !== 'object' || Array.isArray(r) ||
        Object.keys(r).sort().join(',') !== 'sensorId,timestamp,value' ||
        !Number.isSafeInteger(r.sensorId) || !Number.isFinite(r.value) ||
        !Number.isFinite(r.timestamp) || r.timestamp <= 0) {
      this.counters.rejected++; return false;
    }
    const sensor = this.sensors.find(s => s.sensorId === r.sensorId);
    if (!sensor) { this.counters.rejected++; return false; }
    const previous = this.latest.get(r.sensorId);
    if (previous && r.timestamp <= previous.timestamp) { this.counters.outOfOrder++; return false; }
    const now = this.clock();
    const recent = (this.events.get(r.sensorId) ?? []).filter(t => t > now - 5000);
    if (r.value < sensor.min || r.value > sensor.max) {
      this.counters.outOfRange++;
      // Only the last four events are needed to detect the threshold.
      const samples = (this.evidence.get(r.sensorId) ?? []).filter(p => p.receivedAt > now - 5000);
      samples.push({ ...r, receivedAt: now });
      this.evidence.set(r.sensorId, samples.slice(-4));
      if (recent.length < 4 && samples.length >= 4) {
        this.incidents.push({ id: ++this.sequence, sensorId: sensor.sensorId, sensorName: sensor.sensorName,
          unit: sensor.unit, min: sensor.min, max: sensor.max, detectedAt: now, readings: samples.slice(-4) });
        this.incidents = this.incidents.slice(-100);
      }
      recent.push(now);
      if (recent.length >= 4) this.log(`[${new Date(now).toISOString()}] ${sensor.sensorName} (${sensor.sensorId}): more than 3 out-of-range readings in 5 seconds`);
    }
    this.events.set(r.sensorId, recent.slice(-4));
    this.latest.set(r.sensorId, { ...r, receivedAt: now });
    this.counters.accepted++;
    return true;
  }
  snapshot() {
    const now = this.clock();
    return this.sensors.map(sensor => {
      const reading = this.latest.get(sensor.sensorId);
      return {
        sensorId: sensor.sensorId, value: reading?.value ?? null,
        timestamp: reading?.timestamp ?? null, receivedAt: reading?.receivedAt ?? null,
        status: !reading ? 'missing' : now - reading.receivedAt > 5000 ? 'stale' :
          reading.value < sensor.min || reading.value > sensor.max ? 'out_of_range' : 'normal'
      };
    });
  }
}
