import WebSocket from 'ws';
import { parseSensors, TelemetryStore } from './telemetry';

export class EmulatorClient {
  connected = false;
  private stopped = false;
  private socket?: WebSocket;
  private retry?: NodeJS.Timeout;
  private heartbeat?: NodeJS.Timeout;
  private attempts = 0;
  constructor(private base: string, private store: TelemetryStore) {}
  async start() {
    if (this.stopped) return;
    try {
      const response = await fetch(`${this.base.replace(/\/$/, '')}/sensors`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
      const sensors = parseSensors(await response.json());
      if (this.stopped) return;
      this.store.setSensors(sensors);
      const url = new URL(`${this.base.replace(/\/$/, '')}/ws/telemetry`);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = this.socket = new WebSocket(url, { handshakeTimeout: 3000, maxPayload: 65536 });
      let alive = true;
      socket.on('open', () => {
        this.connected = true;
        this.attempts = 0;
        this.heartbeat = setInterval(() => {
          if (!alive) { socket.terminate(); return; }
          alive = false;
          socket.ping();
        }, 10000);
        console.log('Emulator telemetry connected');
      });
      socket.on('pong', () => { alive = true; });
      socket.on('message', data => this.store.ingest(data.toString()));
      socket.on('error', error => console.error('Emulator connection:', error.message));
      socket.on('close', () => {
        this.connected = false;
        clearInterval(this.heartbeat);
        this.scheduleRetry();
      });
    } catch (error) {
      console.error('Emulator unavailable:', error instanceof Error ? error.message : 'Unknown error');
      this.scheduleRetry();
    }
  }
  private scheduleRetry() {
    if (this.stopped) return;
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts++, 5), 30000);
    this.retry = setTimeout(() => void this.start(), delay);
  }
  stop() {
    this.stopped = true;
    this.connected = false;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.socket?.terminate();
  }
}
