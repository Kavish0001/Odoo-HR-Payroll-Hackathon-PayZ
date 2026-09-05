import { type PrismaClient, type TimeOffStatus } from '@prisma/client';

/**
 * The balance math shared by the allocations list, the requests list and the
 * approval transaction.
 *
 * Rule T2: remaining is always derived by querying approved requests, never
 * read from a stored counter that could drift out of sync.
 */

/** The narrow client shape this needs; a `tx` inside `$transaction` satisfies it too. */
export type BalanceClient = Pick<PrismaClient, 'timeOffRequest'>;

export interface AllocationBalance {
  allocatedQty: number;
  takenQty: number;
  remainingQty: number;
}

/**
 * Rule T4: a type flagged `requiresAllocation: false` (Sick Leave, say)
 * skips the balance check entirely — approval never looks for or consumes
 * an allocation for it.
 */
export function requestNeedsAllocation(requiresAllocation: boolean): boolean {
  return requiresAllocation;
}

/** Rule T1: only an APPROVED allocation ever grants balance. */
export function allocationGrantsBalance(status: TimeOffStatus): boolean {
  return status === 'APPROVED';
}

/** Rule T2's arithmetic, isolated so it can be unit tested directly. */
export function remainingFrom(allocatedQty: number, takenQty: number): number {
  return allocatedQty - takenQty;
}

/**
 * Combines T1 and T2: a non-APPROVED allocation grants nothing regardless of
 * what is linked to it, so taken/remaining both read as zero.
 */
export function deriveBalance(
  status: TimeOffStatus,
  allocatedQty: number,
  takenQty: number,
): AllocationBalance {
  if (!allocationGrantsBalance(status)) {
    return { allocatedQty, takenQty: 0, remainingQty: 0 };
  }
  return {
    allocatedQty,
    takenQty,
    remainingQty: remainingFrom(allocatedQty, takenQty),
  };
}

/** Sum of durations of APPROVED requests linked to one allocation. */
export async function sumApprovedDuration(
  client: BalanceClient,
  allocationId: number,
  excludeRequestId?: number,
): Promise<number> {
  const result = await client.timeOffRequest.aggregate({
    where: {
      allocationId,
      status: 'APPROVED',
      ...(excludeRequestId !== undefined
        ? { id: { not: excludeRequestId } }
        : {}),
    },
    _sum: { duration: true },
  });
  return result._sum.duration ?? 0;
}

/** The same sum, batched for a page of allocations in one query. */
export async function sumApprovedDurationByAllocation(
  client: BalanceClient,
  allocationIds: readonly number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (allocationIds.length === 0) {
    return map;
  }

  const rows = await client.timeOffRequest.groupBy({
    by: ['allocationId'],
    where: { allocationId: { in: [...allocationIds] }, status: 'APPROVED' },
    _sum: { duration: true },
  });

  for (const row of rows) {
    if (row.allocationId !== null) {
      map.set(row.allocationId, row._sum.duration ?? 0);
    }
  }
  return map;
}

export interface AllocationValidityWindow {
  validFrom: Date;
  validTo: Date | null;
}

/**
 * Rule T9: a request may only consume an allocation whose validity window
 * covers the request's whole date range.
 */
export function allocationCoversWindow(
  allocation: AllocationValidityWindow,
  requestStart: Date,
  requestEnd: Date,
): boolean {
  if (allocation.validFrom.getTime() > requestStart.getTime()) {
    return false;
  }
  if (
    allocation.validTo !== null &&
    allocation.validTo.getTime() < requestEnd.getTime()
  ) {
    return false;
  }
  return true;
}

export interface AllocationCandidate {
  id: number;
  allocatedQty: number;
  takenQty: number;
}

/**
 * Rule T3: picks the first candidate (already filtered to APPROVED,
 * in-validity allocations of the right type) with enough remaining to cover
 * `duration`. Candidates should be ordered oldest-`validFrom`-first by the
 * caller so a FIFO allocation is preferred. Returns `null` when none
 * qualifies, which the caller turns into a failed approval.
 */
export function pickAllocationForRequest(
  candidates: readonly AllocationCandidate[],
  duration: number,
): number | null {
  for (const candidate of candidates) {
    if (remainingFrom(candidate.allocatedQty, candidate.takenQty) >= duration) {
      return candidate.id;
    }
  }
  return null;
}

/** Full balance for one allocation, read fresh from the requests table. */
export async function computeAllocationBalance(
  client: BalanceClient,
  allocation: { id: number; allocatedQty: number; status: TimeOffStatus },
): Promise<AllocationBalance> {
  if (!allocationGrantsBalance(allocation.status)) {
    return {
      allocatedQty: allocation.allocatedQty,
      takenQty: 0,
      remainingQty: 0,
    };
  }
  const takenQty = await sumApprovedDuration(client, allocation.id);
  return deriveBalance(allocation.status, allocation.allocatedQty, takenQty);
}
