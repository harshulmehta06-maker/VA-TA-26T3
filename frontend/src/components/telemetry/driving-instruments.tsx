'use client';

import { useTelemetry } from './telemetry-provider';

export function DrivingInstrument({ kind }: { kind: 'speed' | 'brake' | 'temperature' | 'charge' | 'steering' }) {
  const { sensors, snapshot, now, lastSuccess } = useTelemetry();
  const sensor = sensors.find(s => s.sensorName === ({ speed: 'VEHICLE_SPEED', brake: 'BRAKE_PRESSURE_FRONT', temperature: 'BATTERY_TEMPERATURE', charge: 'PACK_SOC', steering: 'STEERING_ANGLE' }[kind]));
  const reading = snapshot?.readings.find(r => r.sensorId === sensor?.sensorId);
  const value = reading?.value;
  const missing = value == null || !sensor;
  const stale = !missing && (reading?.status === 'stale' || now - lastSuccess > 5000 || reading?.receivedAt == null || now - reading.receivedAt > 5000);
  const outside = !missing && (value < sensor.min || value > sensor.max);
  const fraction = missing ? 0 : Math.max(0, Math.min(1, (value - sensor.min) / (sensor.max - sensor.min)));
  const colour = missing || stale ? 'hsl(var(--muted-foreground))' : outside ? '#f87171' : 'hsl(var(--primary))';
  const text = missing ? '—' : value.toFixed(2);
  const statusLabel = missing ? 'awaiting data' : stale ? 'stale' : outside ? 'out of range' : 'within range';
  if (kind === 'temperature' || kind === 'charge') {
    // Temperature follows metadata limits; charge represents the physical 0–100% scale.
    const level = kind === 'charge' ? (missing ? 0 : Math.max(0, Math.min(1, value / 100))) : fraction;
    return <svg viewBox="0 0 240 170" className="my-2 w-full max-w-[240px]" role="img"
      aria-label={`${kind === 'temperature' ? 'Battery temperature' : 'State of charge'}: ${text} ${kind === 'temperature' ? '°C' : '%'}, ${statusLabel}`}>
      {kind === 'temperature' ? <>
        <path d="M 52 112 V 30 A 13 13 0 0 1 78 30 V 112 A 23 23 0 1 1 52 112 Z" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        {!missing && <>
          <rect x="59" y={108 - level * 79} width="12" height={20 + level * 79} rx="6" fill={colour} />
          <circle cx="65" cy="131" r="16" fill={colour} />
        </>}
        {[0, 0.25, 0.5, 0.75, 1].map(t => <line key={t} x1="84" x2={t === 0 || t === 1 ? '95' : '90'} y1={108 - t * 79} y2={108 - t * 79} stroke="hsl(var(--muted-foreground))" />)}
        <text x="100" y="33" fontSize="10" fill="hsl(var(--muted-foreground))">{sensor?.max ?? '—'}°</text>
        <text x="100" y="112" fontSize="10" fill="hsl(var(--muted-foreground))">{sensor?.min ?? '—'}°</text>
        <text x="161" y="79" textAnchor="middle" fontSize="27" fontWeight="600" fill="hsl(var(--foreground))" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</text>
        <text x="161" y="100" textAnchor="middle" fontSize="12" fill="hsl(var(--muted-foreground))">°C</text>
      </> : <>
        <rect x="27" y="32" width="178" height="74" rx="10" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="3" />
        <rect x="209" y="55" width="8" height="28" rx="3" fill="hsl(var(--muted-foreground))" />
        {Array.from({ length: 10 }, (_, i) => <g key={i}>
          <rect x={35 + i * 16.2} y="40" width="13" height="58" rx="2" fill="hsl(var(--muted))" />
          <rect x={35 + i * 16.2} y="40" width={13 * Math.max(0, Math.min(1, level * 10 - i))} height="58" rx="2" fill={colour} />
        </g>)}
        <text x="120" y="146" textAnchor="middle" fontSize="30" fontWeight="600" fill="hsl(var(--foreground))" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}<tspan fontSize="14"> %</tspan></text>
      </>}
    </svg>;
  }
  if (kind === 'steering') return <div>
    <h3 className="text-sm text-muted-foreground">Steering angle</h3>
    <svg viewBox="0 0 240 200" className="my-2 w-full max-w-[240px]" role="img" aria-label={`Steering angle: ${text} degrees, ${statusLabel}`}>
      <path d="M 116 9 L 120 16 L 124 9" fill="hsl(var(--muted-foreground))" />
      <g transform={`rotate(${missing ? 0 : value} 120 82)`}>
        <circle cx="120" cy="82" r="57" fill="none" stroke={colour} strokeWidth="9" />
        <path d="M 64 78 L 107 88 M 176 78 L 133 88 M 120 96 V 137" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="10" />
        <circle cx="120" cy="82" r="18" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        <path d="M 120 21 V 32" stroke="hsl(var(--foreground))" strokeWidth="5" />
      </g>
      <text x="120" y="176" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="28" fontWeight="600">{text}°</text>
      <text x="120" y="196" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">Sensor angle · 0° centred</text>
    </svg>
    <span className="rounded bg-muted px-2 py-1 text-xs" style={{ color: missing || stale || outside ? colour : undefined }}>{statusLabel}</span>
  </div>;
  if (kind === 'brake') return <div>
    <h3 className="text-sm text-muted-foreground">Front brake pressure</h3>
    <svg viewBox="0 0 240 200" className="my-2 w-full max-w-[240px]" role="img" aria-label={`Front brake pressure: ${text} ${sensor?.unit ?? 'bar'}, ${statusLabel}`}>
      <circle cx="120" cy="82" r="66" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
      <circle cx="120" cy="82" r="66" fill="none" stroke={colour} strokeWidth="8" pathLength="100" strokeDasharray={`${fraction * 100} 100`} transform="rotate(-90 120 82)" />
      <circle cx="120" cy="82" r="49" fill="hsl(var(--muted))" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
      <circle cx="120" cy="82" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = i * Math.PI / 6;
        return <circle key={i} cx={120 + 38 * Math.cos(angle)} cy={82 + 38 * Math.sin(angle)} r="3" fill="hsl(var(--background))" />;
      })}
      <circle cx="120" cy="82" r="13" fill="hsl(var(--background))" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
      <rect x="153" y="54" width="20" height="55" rx="6" fill={colour} />
      <path d="M 159 64 V 99 M 166 64 V 99" stroke="hsl(var(--background))" strokeWidth="2" />
      <text x="120" y="176" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="28" fontWeight="600" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}<tspan fontSize="13"> {sensor?.unit ?? 'bar'}</tspan></text>
      <text x="120" y="196" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">Range {sensor?.min ?? '—'}–{sensor?.max ?? '—'} {sensor?.unit ?? 'bar'}</text>
    </svg>
    <span className="rounded bg-muted px-2 py-1 text-xs" style={{ color: missing || stale || outside ? colour : undefined }}>{missing ? 'Awaiting data' : stale ? 'Stale' : outside ? 'Out of range' : 'Within range'}</span>
  </div>;
  return <svg viewBox="0 0 240 170" className="my-2 w-full max-w-[240px]" role="img" aria-label={`Vehicle speed: ${text} ${sensor?.unit ?? 'km/h'}${stale ? ', stale' : outside ? ', out of range' : ''}`}>
    {Array.from({ length: 30 }, (_, i) => {
      const start = (135 + i * 9) * Math.PI / 180;
      const end = (135 + i * 9 + 6) * Math.PI / 180;
      return <path key={i} d={`M ${120 + 83 * Math.cos(start)} ${92 + 83 * Math.sin(start)} A 83 83 0 0 1 ${120 + 83 * Math.cos(end)} ${92 + 83 * Math.sin(end)}`} fill="none" stroke={i < fraction * 30 ? colour : 'hsl(var(--border))'} strokeWidth="9" />;
    })}
    <text x="120" y="96" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="30" fontWeight="600" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</text>
    <text x="120" y="117" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12">{sensor?.unit ?? 'km/h'}</text>
    <text x="49" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">{sensor?.min ?? '—'}</text>
    <text x="191" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">{sensor?.max ?? '—'}</text>
  </svg>;
}
