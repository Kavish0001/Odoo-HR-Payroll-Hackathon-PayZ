import { type Contract, type PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from '../../config/prisma.js';

/**
 * Rule C2: payroll resolves the *period-applicable* contract, not "the
 * latest contract". An employee can accumulate several contracts over time
 * (a promotion, a renewal); the one that governs a given payslip period is
 * whichever RUNNING contract's date range overlaps that period, which is a
 * range-overlap test rather than a most-recent lookup.
 */

/** The subset of Contract fields the overlap test needs. */
export type PeriodContractCandidate = Pick<
  Contract,
  'status' | 'startDate' | 'endDate'
>;

/**
 * True when `contract` is the RUNNING contract applicable to
 * [periodStart, periodEnd]:
 *
 *   startDate <= periodEnd AND (endDate IS NULL OR endDate >= periodStart)
 *
 * A contract that is DRAFT, EXPIRED or CANCELLED never matches, however its
 * dates line up — only a RUNNING contract is ever period-applicable.
 */
export function isApplicableToPeriod(
  contract: PeriodContractCandidate,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  if (contract.status !== 'RUNNING') {
    return false;
  }
  if (contract.startDate.getTime() > periodEnd.getTime()) {
    return false;
  }
  if (
    contract.endDate !== null &&
    contract.endDate.getTime() < periodStart.getTime()
  ) {
    return false;
  }
  return true;
}

/** The narrow slice of PrismaClient this helper needs, so tests can mock it. */
export type ContractLookupClient = Pick<PrismaClient, 'contract'>;

/**
 * Resolves the contract that governs a payroll period for one employee.
 *
 * The `contracts_no_overlapping_running` exclusion constraint (rule C1)
 * guarantees at most one RUNNING contract can overlap any given date, so at
 * most one candidate should ever satisfy `isApplicableToPeriod`. Fetching all
 * of the employee's contracts and filtering in memory — rather than pushing
 * the whole overlap test into the `where` clause — keeps that overlap rule
 * expressed once, in a function unit tests can exercise directly.
 */
export async function resolvePeriodContract(
  employeeId: number,
  periodStart: Date,
  periodEnd: Date,
  client: ContractLookupClient = defaultPrisma,
): Promise<Contract | null> {
  const candidates = await client.contract.findMany({
    where: { employeeId },
  });

  return selectPeriodContract(candidates, periodStart, periodEnd);
}

/**
 * The choice itself, with the fetching taken out.
 *
 * A payrun resolves a contract for every employee in it, and asking the
 * database once per employee is a round trip per payslip -- the single
 * slowest thing in a compute. `computePayrunPayslips` fetches every relevant
 * contract in one query and calls this for each employee, which keeps the
 * overlap rule stated exactly once while turning N queries into one.
 */
export function selectPeriodContract(
  candidates: readonly Contract[],
  periodStart: Date,
  periodEnd: Date,
): Contract | null {
  return (
    candidates.find((candidate) =>
      isApplicableToPeriod(candidate, periodStart, periodEnd),
    ) ?? null
  );
}
