import { type ReactNode } from 'react';

import { Card } from '../../components/ui/Card.js';
import { cn } from '../../lib/utils.js';

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: ReactNode;
  tone?: 'up' | 'down' | 'neutral';
}

/** One KPI tile: label, a big font-mono figure, and an optional sub-line. */
export function KpiCard({
  label,
  value,
  sublabel,
  tone = 'neutral',
}: KpiCardProps): React.JSX.Element {
  return (
    <Card className="p-4">
      <p className="text-muted text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="font-mono mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {sublabel !== undefined && (
        <p
          className={cn(
            'mt-1 text-xs',
            tone === 'up' && 'text-success',
            tone === 'down' && 'text-danger',
            tone === 'neutral' && 'text-muted',
          )}
        >
          {sublabel}
        </p>
      )}
    </Card>
  );
}

export function KpiCardSkeleton(): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="bg-line/60 h-3 w-20 animate-pulse rounded" />
      <div className="bg-line/60 mt-2.5 h-7 w-28 animate-pulse rounded" />
      <div className="bg-line/60 mt-2 h-3 w-16 animate-pulse rounded" />
    </Card>
  );
}
