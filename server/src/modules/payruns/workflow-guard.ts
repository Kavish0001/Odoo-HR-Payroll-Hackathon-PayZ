import {
  allowedTransitions,
  canCompute,
  canTransition,
  isPayrunLocked,
  type PayrunStatus,
} from '@payz/shared';

import { conflict } from '../../middleware/errors.js';

/**
 * Pure workflow decisions, factored out of the route handlers so they can be
 * unit tested without a database (rules W4, W5, W6).
 *
 * Every function here consults `shared/src/workflow.ts` rather than
 * reimplementing the state machine; this module only turns those booleans
 * into the 409 the API contract promises, with the legal options listed so a
 * rejected client knows what it may do instead.
 */

/** Throws a 409 naming the legal next states when `to` is not one of them. */
export function ensureLegalTransition(from: PayrunStatus, to: PayrunStatus): void {
  if (!canTransition(from, to)) {
    const legal = allowedTransitions(from);
    throw conflict(
      legal.length > 0
        ? `Cannot move a ${from} payrun to ${to}. Legal next states: ${legal.join(', ')}.`
        : `A ${from} payrun is final and cannot change state.`,
      { from, to, allowed: legal },
    );
  }
}

/** Throws a 409 when Compute is not legal for the current status (rule P9, W4). */
export function ensureComputable(status: PayrunStatus): void {
  if (!canCompute(status)) {
    throw conflict(
      `Cannot compute a ${status} payrun. Compute is only available for a draft or already-computed run.`,
      { status },
    );
  }
}

/** Throws a 409 when the payrun is validated or paid (rule W5). */
export function ensureNotLocked(status: PayrunStatus): void {
  if (isPayrunLocked(status)) {
    throw conflict(
      `This payrun is ${status} and its records can no longer be changed.`,
      { status },
    );
  }
}

/** Throws a 409 when Send Payslips is attempted before validation (rule W8). */
export function ensureSendable(status: PayrunStatus): void {
  if (status !== 'VALIDATED' && status !== 'PAID') {
    throw conflict(
      `Payslips can only be sent once a payrun is validated. Current status: ${status}.`,
      { status },
    );
  }
}

export interface WarningGate {
  blocking: boolean;
  acknowledgedAt: Date | null;
}

/**
 * Rule W6: Validate is refused while any blocking warning stands (it can only
 * go away by fixing the underlying data and recomputing), or while any
 * advisory warning has not been explicitly acknowledged.
 */
export function canValidatePayrun(warnings: readonly WarningGate[]): boolean {
  return warnings.every((warning) =>
    warning.blocking ? false : warning.acknowledgedAt !== null,
  );
}

/** Human-readable reasons Validate is blocked, for the 409 payload. */
export function unresolvedWarningReasons(
  warnings: readonly WarningGate[],
): string[] {
  const reasons: string[] = [];
  const blockingCount = warnings.filter((w) => w.blocking).length;
  const unacknowledgedCount = warnings.filter(
    (w) => !w.blocking && w.acknowledgedAt === null,
  ).length;

  if (blockingCount > 0) {
    reasons.push(
      `${String(blockingCount)} blocking warning${blockingCount === 1 ? '' : 's'} must be resolved (fix the data and recompute).`,
    );
  }
  if (unacknowledgedCount > 0) {
    reasons.push(
      `${String(unacknowledgedCount)} advisory warning${unacknowledgedCount === 1 ? '' : 's'} must be acknowledged.`,
    );
  }
  return reasons;
}
