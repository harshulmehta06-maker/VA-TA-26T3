'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchSensors, fetchLatestTelemetry, SensorMetadata, TelemetrySnapshot } from '../../lib/api-client';
import type { SensorPoint } from './sensor-graph';
function useTelemetryState() {
  const [sensors, setSensors] = useState<SensorMetadata[]>([]);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [lastSuccess, setLastSuccess] = useState(0);
  const [history, setHistory] = useState<Record<number, SensorPoint[]>>({});

  useEffect(() => {
    let disposed = false;
    let metadata: SensorMetadata[] = [];
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;

    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        if (!metadata.length) {
          metadata = await fetchSensors(controller.signal);
          if (!disposed) setSensors(metadata);
        }
        const data = await fetchLatestTelemetry(controller.signal);
        if (!disposed) {
          setSnapshot(data);
          const received = Date.now();
          setNow(received);
          setHistory(previous => {
            const next = { ...previous };
            for (const reading of data.readings) {
              const points = (next[reading.sensorId] ?? []).filter(p => p.timestamp >= received / 1000 - 60);
              // A repeated latest value is not a new sample; preserve its source timestamp.
              if (reading.value !== null && reading.timestamp !== null && reading.status !== 'stale' &&
                  (!points.length || reading.timestamp > points[points.length - 1].timestamp)) {
                points.push({ timestamp: reading.timestamp, value: reading.value });
              }
              next[reading.sensorId] = points.slice(-120);
            }
            return next;
          });
          setLastSuccess(Date.now());
          setError(null);
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error && e.name !== 'AbortError'
          ? e.message : 'Sensor request timed out. Retrying automatically.');
      } finally {
        clearTimeout(timeout);
        // Schedule after completion so slow requests never overlap.
        if (!disposed) timer = setTimeout(poll, 1000);
      }
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearInterval(clock);
      controller?.abort();
    };
  }, []);

  return { sensors, snapshot, error, now, lastSuccess, history };
}
const TelemetryContext = createContext<ReturnType<typeof useTelemetryState> | null>(null);
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const value = useTelemetryState();
  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}
export function useTelemetry() {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error('TelemetryProvider is required');
  return value;
}
