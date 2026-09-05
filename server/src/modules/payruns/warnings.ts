import { isBlockingWarning, type WarningCode } from '@payz/shared';
import { type Prisma, type PrismaClient } from '@prisma/client';

/**
 * Rule W7: every compute recomputes the full warning set for a payslip from
 * scratch. Blocking codes (NO_CONTRACT, DUPLICATE_PAYSLIP, RULE_ERROR) can
 * only go away by fixing the underlying data and recomputing again — nobody
 * acknowledges them away. Advisory codes need an explicit acknowledgement,
 * which is why a recompute preserves one already given rather than resetting
 * it (see `replacePayslipWarnings`) — otherwise every Compute click would
 * silently undo Validate-blocking acknowledgements the payroll officer
 * already made.
 */

export interface WarningInput {
  code: WarningCode;
  message: string;
}

const CONTRACT_EXPIRING_WINDOW_DAYS = 30;

/** True when a contract's end date falls within the window after the period ends. */
export function isContractExpiringSoon(
  contractEndDate: Date | null,
  periodEnd: Date,
  windowDays: number = CONTRACT_EXPIRING_WINDOW_DAYS,
): boolean {
  if (contractEndDate === null) {
    return false;
  }
  const horizon = new Date(periodEnd);
  horizon.setUTCDate(horizon.getUTCDate() + windowDays);
  return contractEndDate.getTime() <= horizon.getTime();
}

export interface EmployeeCompletenessInput {
  departmentId: number | null;
  jobPositionId: number | null;
  joinDate: Date | null;
  workingScheduleId: number | null;
}

/** A record missing basics HR would expect before payroll relies on it. */
export function isEmployeeIncomplete(
  employee: EmployeeCompletenessInput,
): boolean {
  return (
    employee.departmentId === null ||
    employee.jobPositionId === null ||
    employee.joinDate === null ||
    employee.workingScheduleId === null
  );
}

export interface BuildWarningsParams {
  fullName: string;
  hasContract: boolean;
  ruleError: string | null;
  duplicatePayrunName: string | null;
  missingBankAccount: boolean;
  incompleteEmployee: boolean;
  contractExpiring: boolean;
}

/**
 * The full, recomputed warning list for one payslip. Pure, so the decision
 * of what fires is unit-testable without touching the database.
 */
export function buildPayslipWarnings(
  params: BuildWarningsParams,
): WarningInput[] {
  const warnings: WarningInput[] = [];

  if (!params.hasContract) {
    // No contract means nothing else about this payslip can be trusted:
    // the other checks all assume a resolved contract exists.
    warnings.push({
      code: 'NO_CONTRACT',
      message: `${params.fullName} has no contract applicable to this period`,
    });
    return warnings;
  }

  if (params.ruleError !== null) {
    warnings.push({ code: 'RULE_ERROR', message: params.ruleError });
  }

  if (params.duplicatePayrunName !== null) {
    warnings.push({
      code: 'DUPLICATE_PAYSLIP',
      message: `${params.fullName} already has a payslip in "${params.duplicatePayrunName}" for an overlapping period`,
    });
  }

  if (params.missingBankAccount) {
    warnings.push({
      code: 'MISSING_BANK_ACCOUNT',
      message: `${params.fullName} has no bank account on file`,
    });
  }

  if (params.incompleteEmployee) {
    warnings.push({
      code: 'INCOMPLETE_EMPLOYEE',
      message: `${params.fullName}'s employee record is missing required details`,
    });
  }

  if (params.contractExpiring) {
    warnings.push({
      code: 'CONTRACT_EXPIRING',
      message: `${params.fullName}'s contract is ending soon`,
    });
  }

  return warnings;
}

type WarningDb =
  Pick<PrismaClient, 'payrollWarning'> | Prisma.TransactionClient;

/**
 * Deletes this payslip's stored warnings and rewrites them from the freshly
 * computed set (mirrors the payslip-line idempotency of rule P9), carrying
 * forward the acknowledgement on any code that fires again unchanged so a
 * recompute cannot silently re-block Validate.
 */
export async function replacePayslipWarnings(
  db: WarningDb,
  payrunId: number,
  payslipId: number,
  warnings: readonly WarningInput[],
): Promise<void> {
  const existing = await db.payrollWarning.findMany({
    where: { payslipId },
    select: { code: true, acknowledgedAt: true, acknowledgedByUserId: true },
  });
  const previousAck = new Map(
    existing.map((warning) => [
      warning.code,
      {
        acknowledgedAt: warning.acknowledgedAt,
        acknowledgedByUserId: warning.acknowledgedByUserId,
      },
    ]),
  );

  await db.payrollWarning.deleteMany({ where: { payslipId } });

  if (warnings.length === 0) {
    return;
  }

  await db.payrollWarning.createMany({
    data: warnings.map((warning) => {
      const carried = previousAck.get(warning.code);
      return {
        payrunId,
        payslipId,
        code: warning.code,
        message: warning.message,
        blocking: isBlockingWarning(warning.code),
        acknowledgedAt: carried?.acknowledgedAt ?? null,
        acknowledgedByUserId: carried?.acknowledgedByUserId ?? null,
      };
    }),
  });
}
