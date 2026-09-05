import { type PayrunStatus } from './enums.js';

/**
 * The payrun state machine (rules W4, W5).
 *
 * One table consulted by every workflow endpoint, so an illegal transition
 * cannot slip through by being implemented differently in two places.
 */
export const PAYRUN_TRANSITIONS: Record<PayrunStatus, readonly PayrunStatus[]> =
  {
    // Compute may repeat, so DRAFT and COMPUTED both allow COMPUTED.
    DRAFT: ['COMPUTED', 'CANCELLED'],
    COMPUTED: ['COMPUTED', 'VALIDATED', 'DRAFT', 'CANCELLED'],
    VALIDATED: ['PAID', 'CANCELLED'],
    // Terminal. Paid payroll is history and never transitions again (rule W5).
    PAID: [],
    CANCELLED: [],
  };

export function canTransition(from: PayrunStatus, to: PayrunStatus): boolean {
  return PAYRUN_TRANSITIONS[from].includes(to);
}

export function allowedTransitions(
  from: PayrunStatus,
): readonly PayrunStatus[] {
  return PAYRUN_TRANSITIONS[from];
}

/**
 * Validated and paid payruns reject every write, which is what keeps
 * finalised payroll available as accurate history (rule W5).
 */
export const LOCKED_PAYRUN_STATUSES: readonly PayrunStatus[] = [
  'VALIDATED',
  'PAID',
];

export function isPayrunLocked(status: PayrunStatus): boolean {
  return LOCKED_PAYRUN_STATUSES.includes(status);
}

/** Compute is only legal while the run is still open (rule P9, W4). */
export function canCompute(status: PayrunStatus): boolean {
  return status === 'DRAFT' || status === 'COMPUTED';
}

export const PAYRUN_STATUS_LABELS: Record<PayrunStatus, string> = {
  DRAFT: 'Draft',
  COMPUTED: 'Computed',
  VALIDATED: 'Validated',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};
