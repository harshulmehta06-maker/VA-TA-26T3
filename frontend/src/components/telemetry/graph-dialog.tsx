'use client';
import { useEffect, useRef } from 'react';
import { SensorMetadata } from '../../lib/api-client';
import { SensorGraph, SensorPoint } from './sensor-graph';
export function GraphDialog({ sensor, points, now, onClose }: { sensor: SensorMetadata; points: SensorPoint[]; now: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby="expanded-title" className="m-auto w-[min(92vw,900px)] rounded-xl border border-border bg-card p-6 text-foreground backdrop:bg-black/70">
    <div className="mb-4 flex items-center justify-between gap-4"><h2 id="expanded-title" className="text-lg font-semibold">{sensor.sensorName.replaceAll('_', ' ')}</h2><button autoFocus onClick={onClose} className="rounded border border-border px-3 py-2 text-sm">Close</button></div>
    <p className="mb-4 text-sm text-muted-foreground">Live, sampled readings · last 60 seconds. Hover to inspect. Escape closes this view.</p>
    <SensorGraph validMin={sensor.min} validMax={sensor.max} expanded name={sensor.sensorName} unit={sensor.unit === 'C' ? '°C' : sensor.unit} points={points} now={now} />
  </dialog>;
}
