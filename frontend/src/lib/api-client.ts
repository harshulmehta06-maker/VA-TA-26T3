/**
 * API client for the Vehicle Analytics backend.
 * The backend API surface is designed by you in the fullstack assessment (va-fullstack-assessment).
 * The only guaranteed endpoint is GET /health. You must add functions that call your
 * metadata and data routes (paths and response shapes are up to your API design).
 */

export interface SensorMetadata {
  min: number;
  max: number;
  sensorId: number;
  sensorName: string;
  unit: string;
}

export interface TelemetryReading {
  sensorId: number;
  value: number;
  timestamp: number;
}

export interface HealthResponse {
  status: string;
  emulator?: boolean;
  reason?: string;
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export async function fetchHealth(timeoutMs = 3000): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !(res.status === 503 && data.status === 'degraded')) {
      throw new Error(data.reason ?? `Health: ${res.status} ${res.statusText}`);
    }
    return data as HealthResponse;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Health check timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Add your own functions here to call the metadata and data endpoints you
// designed in the API section (e.g. fetchSensors(), fetchLatestTelemetry(),
// or whatever paths and response shapes you defined). Use the types above
// or define new ones to match your API.
// ---------------------------------------------------------------------------

export interface LatestSensorReading {
  sensorId: number;
  value: number | null;
  timestamp: number | null; // Emulator Unix seconds.
  receivedAt: number | null; // API Unix milliseconds.
  status: 'missing' | 'stale' | 'normal' | 'out_of_range';
}

export interface TelemetrySnapshot {
  connected: boolean;
  readings: LatestSensorReading[];
}

async function fetchSensorResource<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 503
    ? 'Waiting for sensor data. Retrying automatically.'
    : `Unable to load sensors (${response.status}). Retrying automatically.`);
  return response.json();
}

export const fetchSensors = (signal: AbortSignal) =>
  fetchSensorResource<SensorMetadata[]>('/sensors', signal);

export const fetchLatestTelemetry = (signal: AbortSignal) =>
  fetchSensorResource<TelemetrySnapshot>('/telemetry/latest', signal);
