import express from 'express';
import cors from 'cors';
import path from 'path';
import { TelemetryStore } from './telemetry';

export function createApp(store: TelemetryStore, upstream: { connected: boolean }) {
  const app = express();
  const startedAt = Date.now();
  app.use(cors());
  app.get('/health', (_req, res) => res.status(upstream.connected ? 200 : 503).json({
    status: upstream.connected ? 'ok' : 'degraded', emulator: upstream.connected,
    sensors: store.sensors.length, counters: store.counters
  }));
  app.get('/sensors', (_req, res) => {
    if (!store.sensors.length) return res.status(503).json({ error: { code: 'NOT_READY', message: 'Sensor metadata is not available yet' } });
    res.json(store.sensors);
  });
  app.get('/telemetry/latest', (_req, res) => {
    if (!store.sensors.length) return res.status(503).json({ error: { code: 'NOT_READY', message: 'Sensor metadata is not available yet' } });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ source: 'emulator', connected: upstream.connected, generatedAt: Date.now(), readings: store.snapshot() });
  });
  app.get('/diagnostics', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ connected: upstream.connected, startedAt, ...store.diagnostics() });
  });
  app.get('/openapi.yaml', (_req, res) => res.sendFile(path.resolve(__dirname, '../openapi.yaml')));
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  return app;
}
