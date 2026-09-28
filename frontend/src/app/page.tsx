'use client';

import Image from 'next/image';
import { TelemetryProvider } from '../components/telemetry/telemetry-provider';
import { TelemetryOverview } from '../components/telemetry/telemetry-overview';
import { SensorTable } from '../components/telemetry/sensor-table';
import { useEffect, useState } from 'react';
import { fetchHealth, API_BASE_URL } from '../lib/api-client';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Page() {
  return <TelemetryProvider><DashboardPage /></TelemetryProvider>;
}

function DashboardPage() {
  // 'checking' → initial state; 'ok' or 'unhealthy' after first health check.
  const [healthStatus, setHealthStatus] = useState<'ok' | 'unhealthy' | 'checking' | 'degraded'>('checking');
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const health = await fetchHealth();
        if (cancelled) return;
        setHealthStatus(health.status === 'degraded' ? 'degraded' : 'ok');
        setHealthError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        // API not reachable or reporting unhealthy.
        setHealthStatus('unhealthy');
        setHealthError(e instanceof Error ? e.message : 'Failed to reach API');
      }
    }

    // Poll /health, but only start the next check after the previous one completes,
    // so we don't accumulate overlapping requests when the API is slow/unreachable.
    (async () => {
      while (!cancelled) {
        await checkHealth();
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-darkmode.svg" alt="Spyder" width={32} height={32} />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Spyder Telemetry</h1>
              <p className="text-xs text-muted-foreground">
                Vehicle Analytics Fullstack Assessment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                healthStatus === 'ok'
                  ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                  : healthStatus === 'checking'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-destructive/20 text-destructive'
              }`}
            >
              {healthStatus === 'ok'
                ? 'API connected'
                : healthStatus === 'checking'
                  ? 'Checking…'
                  : healthStatus === 'degraded' ? 'Emulator disconnected' : 'API unreachable'}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        {healthError && healthStatus === 'unhealthy' && (
          <Card className="border-destructive/40 bg-destructive/10 text-destructive-foreground">
            <CardHeader className="py-4">
              <CardTitle className="text-sm">Cannot reach API</CardTitle>
              <CardDescription className="text-xs text-destructive-foreground/80">
                {healthError}
                {healthError.includes('fetch') || healthError.includes('Failed to reach')
                  ? ` Ensure the API is running at ${API_BASE_URL} (e.g. va-fullstack-assessment: docker compose up, or cd api && npm run dev).`
                  : ''}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <TelemetryOverview />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">All sensors</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <SensorTable />
          </div>
        </section>
      </div>
    </main>
  );
}
