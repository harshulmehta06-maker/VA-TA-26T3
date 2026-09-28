'use client';
import { useTelemetry } from './telemetry-provider';

export function TyrePressure() {
  const { sensors, snapshot, now, lastSuccess } = useTelemetry();
  const wheels = ['FL', 'FR', 'RL', 'RR'].map((position, i) => {
    const sensor = sensors.find(s => s.sensorName === `TYRE_PRESSURE_${position}`);
    const reading = snapshot?.readings.find(r => r.sensorId === sensor?.sensorId);
    const value = reading?.value;
    const missing = value == null || !sensor;
    const stale = !missing && (reading?.status === 'stale' || now - lastSuccess > 5000 || reading?.receivedAt == null || now - reading.receivedAt > 5000);
    const outside = !missing && (value < sensor.min || value > sensor.max);
    const status = missing ? 'Awaiting data' : stale ? 'Stale' : outside ? 'Out of range' : 'Within range';
    return { position, i, status, text: missing ? '—' : value.toFixed(1), unit: sensor?.unit ?? 'kPa', colour: missing || stale ? 'hsl(var(--muted-foreground))' : outside ? '#f87171' : 'hsl(var(--primary))' };
  });
  return <div>
    <h3 className="text-sm text-muted-foreground">Tyre pressures</h3>
    <svg viewBox="0 0 280 230" className="my-2 w-full max-w-[280px]" role="img" aria-label={wheels.map(w => `${w.position}: ${w.text} ${w.unit}, ${w.status}`).join('; ')}>
      <text x="140" y="14" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">FRONT ↑</text>
      <path d="M 127 28 Q 140 19 153 28 L 157 75 L 169 102 L 169 169 Q 140 189 111 169 L 111 102 L 123 75 Z" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
      <path d="M 104 47 H 176 M 101 162 H 179" stroke="hsl(var(--muted-foreground))" strokeWidth="3" />
      <ellipse cx="140" cy="113" rx="15" ry="27" fill="hsl(var(--background))" stroke="hsl(var(--border))" />
      {wheels.map(w => {
        const left = w.i % 2 === 0, y = w.i < 2 ? 43 : 147;
        return <g key={w.position}>
          <rect x={left ? 99 : 165} y={y - 10} width="16" height="35" rx="4" fill={w.colour} />
          <text x={left ? 44 : 236} y={y - 9} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{w.position}</text>
          <text x={left ? 44 : 236} y={y + 8} textAnchor="middle" fontSize="16" fontWeight="600" fill="hsl(var(--foreground))">{w.text}</text>
          <text x={left ? 44 : 236} y={y + 22} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">{w.unit}</text>
          <text x={left ? 44 : 236} y={y + 36} textAnchor="middle" fontSize="8" fill={w.colour}>{w.status}</text>
        </g>;
      })}
      <text x="140" y="220" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">FL / FR front · RL / RR rear</text>
    </svg>
  </div>;
}
