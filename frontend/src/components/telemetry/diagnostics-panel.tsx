'use client';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../lib/api-client';
interface Incident { id: number; sensorId: number; sensorName: string; unit: string; min: number; max: number; detectedAt: number; readings: { value: number; timestamp: number; receivedAt: number }[] }
interface Diagnostics { connected: boolean; startedAt: number; counters: { accepted: number; rejected: number; outOfOrder: number; outOfRange: number }; incidents: Incident[] }
export function DiagnosticsPanel() {
  const session = useRef<number | null>(null);
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [updated, setUpdated] = useState(0);
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>; let controller: AbortController;
    async function poll() {
      controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${API_BASE_URL}/diagnostics`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw Error('Unavailable');
        const next: Diagnostics = await res.json();
        if (!stopped) { if (session.current !== next.startedAt) setSelected(null); session.current = next.startedAt; setData(next); setUpdated(Date.now()); setError(false); }
      } catch { if (!stopped) setError(true); }
      finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(poll, 2000); }
    }
    void poll(); return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, []);
  return <section className="border-t border-border p-4" aria-label="Telemetry diagnostics">
    <h3 className="text-sm font-semibold">Data quality</h3>
    <p className="my-2 text-xs text-muted-foreground" role="status">{error ? 'Diagnostics unavailable — retained counts may be stale. Retrying.' : data ? data.connected ? 'Emulator connected' : 'Emulator disconnected' : 'Loading diagnostics…'}{updated ? ` · Last update ${new Date(updated).toLocaleTimeString()}` : ''}</p>
    <dl className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4">{([['accepted', 'Accepted'], ['rejected', 'Malformed rejected'], ['outOfOrder', 'Old / duplicate ignored'], ['outOfRange', 'Out-of-range accepted']] as const).map(([key, title]) => <div key={key} className="rounded border border-border p-3"><dt className="text-xs text-muted-foreground">{title}</dt><dd className="mt-1 text-xl tabular-nums">{data?.counters[key].toLocaleString() ?? '—'}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">Counts since API startup. Out-of-range readings are included in accepted readings.</p>
    <h3 className="mb-2 mt-6 text-sm font-semibold">Incident timeline</h3>
    <p className="mb-3 text-xs text-muted-foreground">A new incident marks a sensor crossing four out-of-range readings within five seconds. Latest 100 retained; cleared on API restart. Select one to inspect the four triggering readings.</p>
    {!data?.incidents.length && <p className="py-3 text-sm text-muted-foreground">{data ? 'No incidents recorded in this API session yet.' : 'Waiting for incident data…'}</p>}
    <div className="max-h-64 overflow-auto">{data?.incidents.map(i => <button key={i.id} aria-pressed={selected?.id === i.id} onClick={() => setSelected(i)} className={`flex w-full items-center justify-between gap-4 border-b border-border p-3 text-left text-xs hover:bg-muted ${selected?.id === i.id ? 'bg-muted' : ''}`}><span>{i.sensorName.replaceAll('_', ' ')} <span className="text-muted-foreground">· Incident #{i.id}</span></span><span className="whitespace-nowrap">{new Date(i.detectedAt).toLocaleTimeString()} · Inspect →</span></button>)}</div>
    {selected && <div className="mt-4 rounded border border-border p-4"><div className="flex justify-between gap-3"><h4 className="text-sm font-medium">Incident #{selected.id}: {selected.sensorName.replaceAll('_', ' ')}</h4><button className="text-xs underline" onClick={() => setSelected(null)}>Close incident</button></div><p className="my-2 text-xs text-muted-foreground">Valid range: {selected.min}–{selected.max} {selected.unit}. Detected {new Date(selected.detectedAt).toLocaleString()}. These are preserved API samples, not browser polling estimates.</p><table className="w-full text-left text-xs"><thead><tr><th className="py-2">Source timestamp</th><th>Value ({selected.unit})</th><th>API receipt time</th></tr></thead><tbody>{selected.readings.map((r, n) => <tr key={n} className="border-t border-border"><td className="py-2">{new Date(r.timestamp * 1000).toLocaleTimeString()}</td><td>{r.value.toFixed(2)}</td><td>{new Date(r.receivedAt).toLocaleTimeString()}</td></tr>)}</tbody></table></div>}
  </section>;
}
