/**
 * One place that maps a domain status to a colour.
 *
 * Every status in the app resolves through this table, so "Running" is the
 * same green on the contract list, the employee form and the dashboard. Red is
 * reserved for refused, absent and blocking warnings, so it keeps meaning stop
 * rather than becoming decoration.
 */

export type Tone =
  'success' | 'warning' | 'info' | 'accent' | 'teal' | 'danger' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent',
  teal: 'bg-teal-soft text-teal',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-neutral-soft text-neutral',
};

const STATUS_TONE: Record<string, Tone> = {
  // Contracts
  RUNNING: 'success',
  DRAFT: 'warning',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',

  // Attendance
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  MISSING_CHECKOUT: 'warning',

  // Time off and approvals
  APPROVED: 'success',
  TO_APPROVE: 'warning',
  REFUSED: 'danger',

  // Payroll workflow
  COMPUTED: 'info',
  VALIDATED: 'accent',
  PAID: 'success',
  DONE: 'success',

  // Generic
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

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
  /** Override the mapped tone, for one-off cases like payroll warnings. */
  tone?: Tone;
  /** Adds a filled dot, matching the "● Active" treatment in the wireframe. */
  dot?: boolean;
}

export function StatusBadge({
  status,
  tone,
  dot = false,
}: StatusBadgeProps): React.JSX.Element {
  const resolved = tone ?? STATUS_TONE[status] ?? 'neutral';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[resolved]}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-current"
        />
      )}
      {toLabel(status)}
    </span>
  );
}
