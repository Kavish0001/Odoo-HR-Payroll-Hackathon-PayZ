import { type EligibleEmployee, type EmployeeType } from '@payz/shared';
import { type Contract, type PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from '../../config/prisma.js';
import { resolvePeriodContract } from '../contracts/resolve-period-contract.js';

/**
 * Who may enter a payrun, and why someone did not (rule W3).
 *
 * Step one of the wizard only narrows by employee type; the contract check
 * that actually decides eligibility is resolved here from the same
 * `resolvePeriodContract` payroll uses everywhere else, so "eligible in the
 * wizard" and "has a contract at compute time" can never disagree.
 */

export type EligibilityClient = Pick<
  PrismaClient,
  'employee' | 'contract' | 'payslip'
>;

export interface ExcludedEmployee {
  employeeId: number;
  fullName: string;
  reason: string;
}

/**
 * `EligibleEmployee` with the id it actually has.
 *
 * The shared DTO carries `employeeId` as a string because that is what the
 * browser receives. Inside the server it has to stay a number, or the
 * membership test in the create-payrun route silently fails: `Set.has` uses
 * SameValueZero, so `new Set([1]).has('1')` is false and every selected
 * employee would come back reported as ineligible. The route converts at
 * `res.json()` and nowhere earlier.
 */
export type EligibleEmployeeRecord = Omit<EligibleEmployee, 'employeeId'> & {
  employeeId: number;
};

export interface EligibilityResult {
  eligible: EligibleEmployeeRecord[];
  excluded: ExcludedEmployee[];
}

/**
 * The same result with its ids stringified for the response.
 *
 * The internal shape carries numbers so the membership tests in the
 * create-payrun route work; this is the only thing that should ever be handed
 * to `res.json`, and its annotated return type is what makes the compiler
 * complain if the raw record is sent instead.
 */
export function toEligibilityResponse(result: EligibilityResult): {
  eligible: EligibleEmployee[];
  excluded: { employeeId: string; fullName: string; reason: string }[];
} {
  return {
    eligible: result.eligible.map((row) => ({
      ...row,
      employeeId: String(row.employeeId),
    })),
    excluded: result.excluded.map((row) => ({
      ...row,
      employeeId: String(row.employeeId),
    })),
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True when two closed date ranges overlap. */
function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return (
    aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime()
  );
}

/**
 * An employee already has a payslip for an overlapping period in some other
 * non-cancelled payrun (rule W7's DUPLICATE_PAYSLIP, surfaced here as an
 * advisory heads-up before the run even exists).
 */
export async function findDuplicatePayslip(
  employeeId: number,
  periodStart: Date,
  periodEnd: Date,
  excludePayrunId: number | undefined,
  client: EligibilityClient = defaultPrisma,
): Promise<{ payrunId: number; payrunName: string } | null> {
  const candidates = await client.payslip.findMany({
    where: {
      employeeId,
      payrun: {
        status: { not: 'CANCELLED' },
        ...(excludePayrunId === undefined
          ? {}
          : { id: { not: excludePayrunId } }),
      },
    },
    select: {
      periodStart: true,
      periodEnd: true,
      payrunId: true,
      payrun: { select: { name: true } },
    },
  });

  const match = candidates.find((candidate) =>
    periodsOverlap(
      periodStart,
      periodEnd,
      candidate.periodStart,
      candidate.periodEnd,
    ),
  );

  return match === undefined
    ? null
    : { payrunId: match.payrunId, payrunName: match.payrun.name };
}

interface EligibilityScope {
  salaryStructureId: number;
  periodStart: Date;
  periodEnd: Date;
  employeeTypeScope?: EmployeeType | null | undefined;
}

export async function resolveEligibleEmployees(
  scope: EligibilityScope,
  excludePayrunId?: number,
  client: EligibilityClient = defaultPrisma,
): Promise<EligibilityResult> {
  const candidates = await client.employee.findMany({
    where: {
      active: true,
      ...(scope.employeeTypeScope != null
        ? { employeeType: scope.employeeTypeScope }
        : {}),
    },
    include: {
      department: { select: { name: true } },
      workingSchedule: { select: { name: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const eligible: EligibleEmployeeRecord[] = [];
  const excluded: ExcludedEmployee[] = [];

  for (const employee of candidates) {
    const fullName = `${employee.firstName} ${employee.lastName}`;

    const contract: Contract | null = await resolvePeriodContract(
      employee.id,
      scope.periodStart,
      scope.periodEnd,
      client,
    );

    if (contract === null) {
      excluded.push({
        employeeId: employee.id,
        fullName,
        reason: 'No running contract covers this period',
      });
      continue;
    }

    if (contract.salaryStructureId !== scope.salaryStructureId) {
      excluded.push({
        employeeId: employee.id,
        fullName,
        reason: "This employee's contract uses a different salary structure",
      });
      continue;
    }

    const duplicate = await findDuplicatePayslip(
      employee.id,
      scope.periodStart,
      scope.periodEnd,
      excludePayrunId,
      client,
    );

    eligible.push({
      employeeId: employee.id,
      code: employee.code,
      fullName,
      departmentName: employee.department?.name ?? null,
      employeeType: employee.employeeType,
      scheduleName: employee.workingSchedule?.name ?? null,
      contractStartDate: toDateOnly(contract.startDate),
      wageMonthly: contract.wageMonthly,
      contractReference: contract.reference,
      duplicateWarning:
        duplicate === null
          ? null
          : `Already has a payslip in "${duplicate.payrunName}" for an overlapping period`,
    });
  }

  return { eligible, excluded };
}
