'use client';

import { useState } from 'react';
import { GraphDialog } from './graph-dialog';
import { DiagnosticsPanel } from './diagnostics-panel';
import { SensorGraph } from './sensor-graph';
import { SensorMetadata } from '../../lib/api-client';
import { useTelemetry } from './telemetry-provider';

const statusLabels = {
  missing: 'Awaiting data', stale: 'Stale', normal: 'Within range', out_of_range: 'Out of range'
};

export function SensorTable() {
  const [expanded, setExpanded] = useState<SensorMetadata | null>(null);
  const { sensors, snapshot, error, now, lastSuccess, history } = useTelemetry();

  return (
    <div>
      {(error || snapshot && !snapshot.connected) && (
        <p role="status" className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
          {error || 'Emulator disconnected. Waiting for reconnection.'} Retained readings may be stale.
        </p>
      )}
      {!sensors.length ? (
        <p role="status" className="p-6 text-center text-sm text-muted-foreground">
          {error ? 'Sensor metadata is currently unavailable.' : 'Loading sensors…'}
        </p>
      ) : (
        <>
        <p className="px-4 py-3 text-xs text-muted-foreground">Graphs show the last 60 seconds collected in this browser. Hover to inspect a sample. Refreshing clears history.</p>
        <div className="overflow-x-auto" role="region" aria-label="Sensor readings and graphs" tabIndex={0}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Live readings for all sensors, refreshed every second</caption>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>{['Sensor', 'Sensor ID', 'Value', 'Status', 'Timestamp', 'Live trend · 60s'].map(title => (
              <th key={title} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{title}</th>
            ))}</tr>
          </thead>
          <tbody>
            {sensors.map(sensor => {
              const reading = snapshot?.readings.find(r => r.sensorId === sensor.sensorId);
              const stale = reading?.value != null && (now - lastSuccess > 5000 ||
                reading.receivedAt !== null && now - reading.receivedAt > 5000);
              const status = stale ? 'stale' : reading?.status ?? 'missing';
              return (
                <tr key={sensor.sensorId} className="border-b border-border last:border-0">
                  <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">{sensor.sensorName.replaceAll('_', ' ')}</th>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sensor.sensorId}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                    {reading?.value == null ? '—' : reading.value.toFixed(2)}{' '}
                    <span className="text-muted-foreground">{sensor.unit === 'C' ? '°C' : sensor.unit}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded px-2 py-1 text-xs ${status === 'out_of_range'
                      ? 'bg-destructive/10 text-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                    {reading?.timestamp == null ? '—' : new Date(reading.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3">
                    <button className="mb-2 text-xs underline underline-offset-4" onClick={() => setExpanded(sensor)}>Expand {sensor.sensorName.replaceAll('_', ' ')} graph</button>
                    <SensorGraph validMin={sensor.min} validMax={sensor.max} points={history[sensor.sensorId] ?? []} now={now}
                      name={sensor.sensorName.replaceAll('_', ' ')} unit={sensor.unit === 'C' ? '°C' : sensor.unit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {expanded && <GraphDialog sensor={expanded} points={history[expanded.sensorId] ?? []} now={now} onClose={() => setExpanded(null)} />}
        <DiagnosticsPanel />
        </>
      )}
    </div>
  );
}
