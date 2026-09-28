'use client';
import { useState } from 'react';
import { TyrePressure } from './tyre-pressure';
import { DrivingInstrument } from './driving-instruments';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SensorGraph } from './sensor-graph';
import { useTelemetry } from './telemetry-provider';

const primary = [
  { name: 'VEHICLE_SPEED', label: 'Vehicle Speed' },
  { name: 'BATTERY_TEMPERATURE', label: 'Battery Temperature' },
  { name: 'PACK_SOC', label: 'State of Charge' }
];
const labels = { missing: 'Awaiting data', stale: 'Stale', normal: 'Within range', out_of_range: 'Out of range' };
export function TelemetryOverview() {
  const { sensors, snapshot, history, now, lastSuccess, error } = useTelemetry();
  const [selectedName, setSelectedName] = useState('VEHICLE_SPEED');
  const selected = sensors.find(s => s.sensorName === selectedName) ?? sensors[0];
  return <>
    <Card className="border-muted">
      <CardHeader><CardTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Primary metrics</CardTitle></CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">{primary.map(metric => {
          const sensor = sensors.find(s => s.sensorName === metric.name);
          const reading = snapshot?.readings.find(r => r.sensorId === sensor?.sensorId);
          const stale = reading?.value != null && (now - lastSuccess > 5000 || reading.receivedAt !== null && now - reading.receivedAt > 5000);
          const status = stale ? 'stale' : reading?.status ?? 'missing';
          return <div key={metric.name}>
            <h3 className="text-sm text-muted-foreground">{metric.label}</h3>
            <DrivingInstrument kind={metric.name === 'VEHICLE_SPEED' ? 'speed' : metric.name === 'BATTERY_TEMPERATURE' ? 'temperature' : 'charge'} />
            <span className={`rounded px-2 py-1 text-xs ${status === 'out_of_range' ? 'bg-destructive/10 text-foreground' : 'bg-muted text-muted-foreground'}`}>{labels[status]}</span>
          </div>;
        })}</div>
        <div className="mt-6 grid gap-6 border-t border-border pt-4 sm:grid-cols-3">
          <DrivingInstrument kind="brake" />
          <DrivingInstrument kind="steering" />
          <TyrePressure />
        </div>
        {error && <p role="status" className="mt-4 text-xs text-muted-foreground">{error} Retained values may be stale.</p>}
      </CardContent>
    </Card>
    <Card className="border-muted">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{selected?.sensorName.replaceAll('_', ' ') ?? 'Sensor'} telemetry</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Sensor
            <select aria-label="Telemetry graph sensor" value={selected?.sensorName ?? ''} onChange={e => setSelectedName(e.target.value)} className="max-w-full rounded border border-border bg-card px-3 py-2 text-foreground" disabled={!sensors.length}>
              {!sensors.length && <option value="">Loading sensors…</option>}
              {sensors.map(s => <option key={s.sensorId} value={s.sensorName}>{s.sensorName.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {selected ? <SensorGraph validMin={selected.min} validMax={selected.max} key={selected.sensorId} expanded points={history[selected.sensorId] ?? []} now={now} name={selected.sensorName.replaceAll('_', ' ')} unit={selected.unit === 'C' ? '°C' : selected.unit} /> : <p className="py-12 text-center text-sm text-muted-foreground">Waiting for sensor metadata…</p>}
        <p className="mt-3 text-xs text-muted-foreground">Simulated telemetry · Last 60 seconds collected in this browser. Hover to inspect. Refreshing clears history.</p>
      </CardContent>
    </Card>
  </>;
}
