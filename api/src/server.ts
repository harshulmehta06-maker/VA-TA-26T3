import http from 'http';
import { createApp } from './app';
import { EmulatorClient } from './emulator-client';
import { TelemetryStore } from './telemetry';

const store = new TelemetryStore();
const emulator = new EmulatorClient(process.env.EMULATOR_URL || 'http://localhost:3001', store);
const server = http.createServer(createApp(store, emulator));
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
  void emulator.start();
});
function shutdown() {
  emulator.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
