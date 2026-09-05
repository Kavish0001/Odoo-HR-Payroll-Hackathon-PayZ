import { Prisma, type PrismaClient, type TimeOffStatus } from '@prisma/client';

import {
  conflict,
  notFound,
  unprocessable,
  type AppError,
} from '../../middleware/errors.js';

import {
  allocationCoversWindow,
  pickAllocationForRequest,
  requestNeedsAllocation,
  sumApprovedDurationByAllocation,
  type AllocationValidityWindow,
} from './balance.js';

export interface ApproveRequestResult {
  id: number;
  status: TimeOffStatus;
  allocationId: number | null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function describeWindow(allocation: AllocationValidityWindow): string {
  return `${toDateOnly(allocation.validFrom)} to ${
    allocation.validTo === null ? 'no end date' : toDateOnly(allocation.validTo)
  }`;
}

/**
 * Rule T9's own failure, kept distinct from rule T3's.
 *
 * The two are refused at the same point in the flow but are not the same
 * problem: T3 means the days have been used up, T9 means the days exist and
 * the request is simply outside the dates they cover. Reporting T9 as
 * INSUFFICIENT_BALANCE sends the approver hunting for a balance that is
 * sitting right there, so the window that actually blocked it is named in
 * the message and the code differs, letting the client branch on it.
 */
export function outsideAllocationWindow(
  allocations: readonly AllocationValidityWindow[],
): AppError {
  const windows = allocations.map(describeWindow).join('; ');
  return unprocessable(
    'OUTSIDE_ALLOCATION_WINDOW',
    `These dates fall outside every approved allocation for this leave type (valid ${windows})`,
  );
}

/**
 * Approves a time off request.
 *
 * Runs inside `prisma.$transaction` and, when the type requires an
 * allocation, takes a row lock on every candidate allocation with
 * `SELECT ... FOR UPDATE` before re-reading its remaining balance. A second
 * manager approving a different request against the same allocation blocks
 * on that lock until this transaction commits, so the re-read it eventually
 * performs already reflects this approval — two concurrent approvals can
 * never overdraw the same allocation (guardrail 10.7).
 *
 * Callers are expected to have already run `refuseSelfApproval` (rule T8),
 * since that check needs the Express request and has no place in a
 * framework-agnostic transaction helper.
 */
export async function approveTimeOffRequest(
  client: PrismaClient,
  requestId: number,
  approverId: number,
): Promise<ApproveRequestResult> {
  return client.$transaction(async (tx) => {
    const request = await tx.timeOffRequest.findUnique({
      where: { id: requestId },
      include: { type: { select: { requiresAllocation: true } } },
    });
    if (request === null) {
      throw notFound('Time off request not found');
    }
    // A refused request can be approved after the fact: approvers reverse
    // decisions, and the balance is consumed through this same locked path,
    // so the correction is safe. Only an already-approved or cancelled
    // request is refused here.
    if (request.status !== 'TO_APPROVE' && request.status !== 'REFUSED') {
      throw conflict(
        request.status === 'APPROVED'
          ? 'This request is already approved'
          : 'A cancelled request cannot be approved',
      );
    }

    // Rule T7: reject if this would leave the employee with two overlapping
    // APPROVED requests. Inclusive-bounds overlap test, mirroring the one in
    // contracts/contracts.routes.ts.
    const overlapping = await tx.timeOffRequest.findFirst({
      where: {
        employeeId: request.employeeId,
        status: 'APPROVED',
        id: { not: request.id },
        startDate: { lte: request.endDate },
        endDate: { gte: request.startDate },
      },
      select: { id: true },
    });
    if (overlapping !== null) {
      throw conflict(
        'Overlaps another approved time off request for this employee',
      );
    }

    // Rule T4: a type that does not require an allocation skips the balance
    // check entirely; nothing is consumed.
    if (!requestNeedsAllocation(request.type.requiresAllocation)) {
      const updated = await tx.timeOffRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', approverId, allocationId: null },
      });
      return {
        id: updated.id,
        status: updated.status,
        allocationId: updated.allocationId,
      };
    }

    const approvedAllocations = await tx.timeOffAllocation.findMany({
      where: {
        employeeId: request.employeeId,
        typeId: request.typeId,
        status: 'APPROVED',
      },
      orderBy: { validFrom: 'asc' },
      select: { id: true, allocatedQty: true, validFrom: true, validTo: true },
    });

    // Rule T9: only allocations whose validity window covers the whole
    // request may be considered.
    const inWindow = approvedAllocations.filter((allocation) =>
      allocationCoversWindow(allocation, request.startDate, request.endDate),
    );

    // The employee holds approved allocations for this type, but none of them
    // spans these dates: that is a T9 refusal, not a T3 one, and saying so
    // is the difference between "ask for a new allocation covering April" and
    // "you are out of days".
    if (approvedAllocations.length > 0 && inWindow.length === 0) {
      throw outsideAllocationWindow(approvedAllocations);
    }

    if (inWindow.length > 0) {
      const ids = inWindow.map((allocation) => allocation.id);

      // Lock every candidate row up front so a concurrent approval against
      // any of them cannot read a stale remaining balance (guardrail 10.7).
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "time_off_allocations" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`,
      );

      const takenMap = await sumApprovedDurationByAllocation(tx, ids);
      const candidates = inWindow.map((allocation) => ({
        id: allocation.id,
        allocatedQty: allocation.allocatedQty,
        takenQty: takenMap.get(allocation.id) ?? 0,
      }));

      const chosenId = pickAllocationForRequest(candidates, request.duration);
      if (chosenId !== null) {
        const updated = await tx.timeOffRequest.update({
          where: { id: request.id },
          data: { status: 'APPROVED', approverId, allocationId: chosenId },
        });
        return {
          id: updated.id,
          status: updated.status,
          allocationId: updated.allocationId,
        };
      }
    }

    // Rule T3: either the employee holds no approved allocation for this type
    // at all, or the ones covering these dates are exhausted. Both are
    // genuinely a balance problem, so both keep the original code.
    throw unprocessable(
      'INSUFFICIENT_BALANCE',
      'No approved allocation has enough remaining balance for this request',
    );
  });
}
