import { type ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: ReactNode;
  tone?: 'up' | 'down' | 'neutral';
  /**
   * Marks the single most important figure on the page. Its underline is red;
   * every other card's is muted steel. Exactly one card should set this, or
   * the emphasis stops meaning anything.
   */
  primary?: boolean;
}

/**
 * One KPI tile from the mockup: a brushed-metal badge, a monospace label, the
 * figure in the display face, and a thin rule beneath it.
 *
 * The rule is the whole device. Red on one card, steel on the rest, so the eye
 * lands on the number that matters before reading a single word.
 */
export function KpiCard({
  label,
  value,
  sublabel,
  tone = 'neutral',
  primary = false,
}: KpiCardProps): React.JSX.Element {
  return (
    <div className="bg-raised flex flex-col p-5">
      <span aria-hidden="true" className="metal-badge mb-4 h-6 w-6 shrink-0" />

      <p className="eyebrow">{label}</p>

      <p className="font-display mt-2 text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>

      <span
        aria-hidden="true"
        className={`mt-2 block h-[3px] w-24 ${
          primary ? 'bg-signal' : 'bg-steel-300'
        }`}
      />

      {sublabel !== undefined && (
        <p
          className={`mt-3 text-xs ${
            tone === 'down' ? 'text-signal' : 'text-muted'
          }`}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}

export function KpiCardSkeleton(): React.JSX.Element {
  return (
    <div className="bg-raised p-5">
      <div className="bg-steel-100 mb-4 h-6 w-6 animate-pulse rounded-full" />
      <div className="bg-steel-100 h-3 w-28 animate-pulse rounded-sm" />
      <div className="bg-steel-100 mt-3 h-8 w-24 animate-pulse rounded-sm" />
      <div className="bg-steel-300 mt-2 h-[3px] w-24" />
    </div>
  );
}
