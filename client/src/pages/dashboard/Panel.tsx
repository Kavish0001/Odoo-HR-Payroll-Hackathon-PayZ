import { type ReactNode } from 'react';

import { Card } from '../../components/ui/Card.js';

interface PanelProps {
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

/** A titled section card, the unit every dashboard panel below the KPI row is built from. */
export function Panel({
  title,
  subtitle,
  children,
  className,
}: PanelProps): React.JSX.Element {
  return (
    <Card className={className ?? 'p-4'}>
      {/* Panel titles are eyebrows, not headings: the page has one heading. */}
      <h2 className="eyebrow">{title}</h2>
      {subtitle !== undefined && (
        <p className="text-muted mt-1 text-xs">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function PanelSkeleton({
  height = 220,
}: {
  height?: number;
}): React.JSX.Element {
  return (
    <Card className="p-4">
      <div className="bg-line/60 h-4 w-40 animate-pulse rounded" />
      <div
        className="bg-line/40 mt-3 w-full animate-pulse rounded"
        style={{ height }}
      />
    </Card>
  );
}
