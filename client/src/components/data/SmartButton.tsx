import { Link } from 'react-router-dom';

import { cn } from '../../lib/utils.js';

import { type Tone } from './StatusBadge.js';

interface SmartButtonProps {
  label: string;
  count: number;
  to: string;
  tone?: Tone;
}

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  accent: 'text-accent',
  teal: 'text-teal',
  danger: 'text-danger',
  neutral: 'text-neutral',
};

/**
 * The count button from the wireframe (`Contracts 2`, `Attendance 14`, ...).
 * Always links through to the filtered list for the record it decorates.
 */
export function SmartButton({
  label,
  count,
  to,
  tone = 'info',
}: SmartButtonProps): React.JSX.Element {
  return (
    <Link
      to={to}
      className="border-steel-300 hover:bg-steel-50 flex min-w-24 flex-col items-center rounded-sm border px-4 py-2 text-center transition-colors"
    >
      <span className={cn('font-mono text-lg font-bold', TONE_TEXT[tone])}>
        {count}
      </span>
      <span className="text-muted text-xs">{label}</span>
    </Link>
  );
}
