/**
 * One place that maps a domain status to its treatment.
 *
 * The palette has four colours, so status cannot separate by hue the way it
 * usually would. Instead the dot carries the meaning: red means someone has to
 * do something, grey means it is only information. Weight does the rest, with
 * settled states in ink and retired ones muted.
 *
 * That constraint is the point. Because almost nothing on a screen is red, a
 * red dot is genuinely noticed.
 */

export type Tone =
  'success' | 'warning' | 'info' | 'accent' | 'teal' | 'danger' | 'neutral';

/**
 * Statuses that need a human to act. These get the red dot; everything else is
 * informational and gets grey.
 */
const NEEDS_ACTION = new Set([
  'TO_APPROVE',
  'ABSENT',
  'REFUSED',
  'MISSING_CHECKOUT',
]);

/** Settled and good: rendered in ink rather than muted. */
const SETTLED = new Set([
  'RUNNING',
  'APPROVED',
  'PAID',
  'DONE',
  'ACTIVE',
  'PRESENT',
  'VALIDATED',
]);

/** Retired, not wrong: expired contracts, cancelled runs, inactive accounts. */
const RETIRED = new Set(['EXPIRED', 'CANCELLED', 'INACTIVE']);

const LABELS: Record<string, string> = {
  TO_APPROVE: 'To Approve',
  MISSING_CHECKOUT: 'Missing Check-out',
};

function toLabel(status: string): string {
  return (
    LABELS[status] ??
    status
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  );
}

interface StatusBadgeProps {
  status: string;
  /** Forces the action treatment when the status alone cannot say. */
  tone?: Tone;
  /** Show the leading dot. The wireframe's "* Active" treatment. */
  dot?: boolean;
}

export function StatusBadge({
  status,
  tone,
  dot = true,
}: StatusBadgeProps): React.JSX.Element {
  const needsAction = tone === 'danger' || NEEDS_ACTION.has(status);
  const settled = SETTLED.has(status);
  const retired = RETIRED.has(status);

  return (
    <span
      className={[
        'font-mono inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] tracking-wide uppercase whitespace-nowrap',
        needsAction
          ? 'border-danger-line bg-danger-soft text-ink'
          : settled
            ? 'border-steel-300 bg-steel-100 text-ink'
            : retired
              ? 'border-steel-300 text-muted bg-transparent'
              : 'border-steel-300 bg-steel-100 text-muted',
      ].join(' ')}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            needsAction ? 'bg-signal' : retired ? 'bg-steel-300' : 'bg-muted'
          }`}
        />
      )}
      {toLabel(status)}
    </span>
  );
}

/**
 * The standalone dot for alert lists, where the row carries its own text.
 * Red means act, grey means note.
 */
export function AlertDot({
  needsAction,
}: {
  needsAction: boolean;
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
        needsAction ? 'bg-signal' : 'bg-steel-300'
      }`}
    />
  );
}
