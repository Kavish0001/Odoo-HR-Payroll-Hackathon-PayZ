import { useEffect, useState } from 'react';

import { Logo } from './components/brand/Logo.js';

interface HealthResponse {
  status: string;
  database: { connected: boolean; host: string };
  uptime: number;
}

/**
 * Placeholder shell for P0. Replaced by the router and AppLayout in P1.
 * It calls /api/health so the checkpoint proves the proxy and the API are
 * actually wired, not merely that both processes start.
 */
export function App(): React.JSX.Element {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json() as Promise<HealthResponse>)
      .then(setHealth)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Unknown error');
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6">
      <header className="flex items-center gap-4">
        <Logo size={64} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PayZ</h1>
          <p className="text-muted text-sm">
            Integrated HR &amp; Payroll platform
          </p>
        </div>
      </header>

      <section className="border-line bg-raised rounded-lg border p-4">
        <h2 className="mb-3 text-xs font-medium tracking-wide uppercase">
          API status
        </h2>
        {error !== null && (
          <p className="text-danger font-mono text-sm">{error}</p>
        )}
        {health === null && error === null && (
          <p className="text-muted font-mono text-sm">checking…</p>
        )}
        {health !== null && (
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 font-mono text-sm">
            <dt className="text-muted">status</dt>
            <dd>{health.status}</dd>
            <dt className="text-muted">database</dt>
            <dd>{health.database.connected ? 'connected' : 'unreachable'}</dd>
            <dt className="text-muted">host</dt>
            <dd>{health.database.host}</dd>
            <dt className="text-muted">uptime</dt>
            <dd>{health.uptime}s</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
