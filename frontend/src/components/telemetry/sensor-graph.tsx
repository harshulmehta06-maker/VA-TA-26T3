'use client';

import { useId, useState } from 'react';
export interface SensorPoint { timestamp: number; value: number }

/** A real time axis preserves gaps when the API or sensor stops updating. */
export function SensorGraph({ points, now, name, unit, expanded = false, validMin, validMax }: {
  points: SensorPoint[]; now: number; name: string; unit: string; expanded?: boolean; validMin: number; validMax: number;
}) {
  const gradientId = useId();
  const [inspection, setInspection] = useState<number | null>(null);
  const end = now / 1000;
  const visible = points.filter(p => p.timestamp >= end - 60 && p.timestamp <= end);
  const min = visible.length ? Math.min(...visible.map(p => p.value)) : 0;
  const max = visible.length ? Math.max(...visible.map(p => p.value)) : 1;
  const padding = Math.max((max - min) * 0.15, Math.abs(max) * 0.01, 0.1);
  const low = min - padding, high = max + padding;
  const x = (t: number) => 50 + (t - end + 60) / 60 * 235;
  const y = (v: number) => 82 - (v - low) / (high - low) * 65;
  const segments: SensorPoint[][] = [];
  visible.forEach((p, i) => {
    if (!i || p.timestamp - visible[i - 1].timestamp > 5) segments.push([]);
    segments[segments.length - 1].push(p);
  });
  // Hard gradient stops colour each part of the line by its actual y-value,
  // including where a segment crosses a valid-range boundary.
  const upperStop = Math.max(0, Math.min(1, (high - validMax) / (high - low)));
  const lowerStop = Math.max(0, Math.min(1, (high - validMin) / (high - low)));
  const colour = (value: number) => value >= validMin && value <= validMax ? '#4ade80' : '#f87171';
  const selected = inspection === null ? undefined : visible.reduce<SensorPoint | undefined>((best, p) =>
    !best || Math.abs(p.timestamp - inspection) < Math.abs(best.timestamp - inspection) ? p : best, undefined);
  const display = selected ?? visible[visible.length - 1];
  return (
    <div className={expanded ? "w-full" : "w-[300px]"}>
      <svg viewBox="0 0 300 112" className="block w-full" role="img"
        aria-label={`${name}: last 60 seconds in ${unit}, ${visible.length} samples`}
        onPointerLeave={() => setInspection(null)}
        onPointerMove={e => { const rect = e.currentTarget.getBoundingClientRect();
          setInspection(end - 60 + ((e.clientX - rect.left) / rect.width * 300 - 50) / 235 * 60);
        }}>
        <title>{name} — sampled live readings, last 60 seconds</title>
        <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="17" y2="82">
          <stop offset="0" stopColor="#f87171" />
          <stop offset={upperStop} stopColor="#f87171" /><stop offset={upperStop} stopColor="#4ade80" />
          <stop offset={lowerStop} stopColor="#4ade80" /><stop offset={lowerStop} stopColor="#f87171" />
          <stop offset="1" stopColor="#f87171" />
        </linearGradient></defs>
        {[low, (low + high) / 2, high].map((v, i) => (
          <g key={i}>
            <line x1="50" x2="285" y1={y(v)} y2={y(v)} stroke="hsl(var(--border))" />
            <text x="43" y={y(v) + 3} textAnchor="end" fontSize="9" fill="hsl(var(--muted-foreground))">{v.toFixed(1)}</text>
          </g>
        ))}
        {segments.map((segment, i) => segment.length === 1
          ? <circle key={i} cx={x(segment[0].timestamp)} cy={y(segment[0].value)} r="2.5" fill={colour(segment[0].value)} />
          : <polyline key={i} points={segment.map(p => `${x(p.timestamp)},${y(p.value)}`).join(' ')} fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinejoin="round" />)}
        {selected && <circle cx={x(selected.timestamp)} cy={y(selected.value)} r="4" fill="hsl(var(--foreground))" />}
        <text x="50" y="101" fontSize="9" fill="hsl(var(--muted-foreground))">−60s</text>
        <text x="167" y="101" fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))">−30s</text>
        <text x="285" y="101" fontSize="9" textAnchor="end" fill="hsl(var(--muted-foreground))">Now</text>
        {!visible.length && <text x="167" y="50" fontSize="10" textAnchor="middle" fill="hsl(var(--muted-foreground))">Collecting readings…</text>}
      </svg>
      <div className="flex justify-end gap-3 text-[10px]">
        <span style={{ color: '#4ade80' }}>Within range</span><span style={{ color: '#f87171' }}>Outside range</span>
      </div>
      <div className="text-right text-[10px] tabular-nums text-muted-foreground">
        {display ? `${display.value.toFixed(2)} ${unit} · ${new Date(display.timestamp * 1000).toLocaleTimeString()}` : 'Awaiting a new sample'}
      </div>
    </div>
  );
}
