import { type TimeOffStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  allocationCoversWindow,
  allocationGrantsBalance,
  deriveBalance,
  pickAllocationForRequest,
  remainingFrom,
  requestNeedsAllocation,
  sumApprovedDuration,
  sumApprovedDurationByAllocation,
  type BalanceClient,
} from './balance.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface FakeRequest {
  id: string;
  allocationId: string | null;
  status: TimeOffStatus;
  duration: number;
}

/**
 * A minimal in-memory stand-in for the slice of PrismaClient the balance
 * module needs, mirroring the fake-client pattern in
 * resolve-period-contract.test.ts. Only the query shapes `balance.ts`
 * actually issues are implemented.
 */
function fakeClient(requests: FakeRequest[]): BalanceClient {
  return {
    timeOffRequest: {
      aggregate: vi.fn(
        ({
          where,
        }: {
          where: {
            allocationId: string;
            status: TimeOffStatus;
            id?: { not: string };
          };
        }) => {
          const matching = requests.filter(
            (request) =>
              request.allocationId === where.allocationId &&
              request.status === where.status &&
              where.id?.not !== request.id,
          );
          const sum = matching.reduce((total, r) => total + r.duration, 0);
          return Promise.resolve({
            _sum: { duration: matching.length > 0 ? sum : null },
          });
        },
      ),
      groupBy: vi.fn(
        ({
          where,
        }: {
          where: { allocationId: { in: string[] }; status: TimeOffStatus };
        }) => {
          const byAllocation = new Map<string, number>();
          for (const request of requests) {
            if (
              request.allocationId !== null &&
              where.allocationId.in.includes(request.allocationId) &&
              request.status === where.status
            ) {
              byAllocation.set(
                request.allocationId,
                (byAllocation.get(request.allocationId) ?? 0) +
                  request.duration,
              );
            }
          }
          return Promise.resolve(
            [...byAllocation.entries()].map(([allocationId, sum]) => ({
              allocationId,
              _sum: { duration: sum },
            })),
          );
        },
      ),
    },
  } as unknown as BalanceClient;
}

// ---------------------------------------------------------------------------
// T1 — only an APPROVED allocation creates balance.
// ---------------------------------------------------------------------------
describe('rule T1: only APPROVED allocations grant balance', () => {
  it('grants balance for an APPROVED allocation', () => {
    expect(allocationGrantsBalance('APPROVED')).toBe(true);
  });

  it.each(['TO_APPROVE', 'REFUSED', 'CANCELLED'] as const)(
    'grants nothing for a %s allocation',
    (status) => {
      expect(allocationGrantsBalance(status)).toBe(false);
    },
  );

  it('reports zero taken and zero remaining for a TO_APPROVE allocation, whatever is linked to it', () => {
    const balance = deriveBalance('TO_APPROVE', 20, 5);
    expect(balance).toEqual({ allocatedQty: 20, takenQty: 0, remainingQty: 0 });
  });

  it('reports the real taken/remaining split once the allocation is APPROVED', () => {
    const balance = deriveBalance('APPROVED', 20, 5);
    expect(balance).toEqual({
      allocatedQty: 20,
      takenQty: 5,
      remainingQty: 15,
    });
  });
});

// ---------------------------------------------------------------------------
// T2 — remaining is always derived by query, never a stored counter.
// ---------------------------------------------------------------------------
describe('rule T2: remaining is derived from approved requests', () => {
  it('subtracts taken from allocated', () => {
    expect(remainingFrom(20, 12)).toBe(8);
  });

  it('sums only APPROVED requests linked to the allocation', async () => {
    const client = fakeClient([
      { id: 'r1', allocationId: 'alloc-1', status: 'APPROVED', duration: 3 },
      {
        id: 'r2',
        allocationId: 'alloc-1',
        status: 'TO_APPROVE',
        duration: 100,
      },
      { id: 'r3', allocationId: 'alloc-1', status: 'REFUSED', duration: 100 },
      { id: 'r4', allocationId: 'alloc-2', status: 'APPROVED', duration: 100 },
    ]);

    await expect(sumApprovedDuration(client, 'alloc-1')).resolves.toBe(3);
  });

  it('returns zero when nothing has been approved against the allocation', async () => {
    const client = fakeClient([]);
    await expect(sumApprovedDuration(client, 'alloc-1')).resolves.toBe(0);
  });

  it('excludes a given request id, for recomputing "what remains without this one"', async () => {
    const client = fakeClient([
      { id: 'r1', allocationId: 'alloc-1', status: 'APPROVED', duration: 3 },
      { id: 'r2', allocationId: 'alloc-1', status: 'APPROVED', duration: 4 },
    ]);

    await expect(sumApprovedDuration(client, 'alloc-1', 'r2')).resolves.toBe(3);
  });

  it('batches the sum for several allocations in one query', async () => {
    const client = fakeClient([
      { id: 'r1', allocationId: 'alloc-1', status: 'APPROVED', duration: 3 },
      { id: 'r2', allocationId: 'alloc-2', status: 'APPROVED', duration: 4 },
      {
        id: 'r3',
        allocationId: 'alloc-2',
        status: 'TO_APPROVE',
        duration: 100,
      },
    ]);

    const map = await sumApprovedDurationByAllocation(client, [
      'alloc-1',
      'alloc-2',
    ]);
    expect(map.get('alloc-1')).toBe(3);
    expect(map.get('alloc-2')).toBe(4);
  });

  it('reflects a change in status immediately, since nothing is cached (rule T5 depends on this)', async () => {
    const requests: FakeRequest[] = [
      { id: 'r1', allocationId: 'alloc-1', status: 'APPROVED', duration: 5 },
    ];
    const client = fakeClient(requests);

    await expect(sumApprovedDuration(client, 'alloc-1')).resolves.toBe(5);

    // Simulate the refuse/cancel endpoint flipping the request's status.
    requests[0]!.status = 'REFUSED';

    await expect(sumApprovedDuration(client, 'alloc-1')).resolves.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T3 — approval fails without enough remaining on an approved, in-validity
// allocation; the winning allocation is recorded.
// ---------------------------------------------------------------------------
describe('rule T3: approval requires enough remaining balance', () => {
  it('picks the first candidate with enough remaining', () => {
    const chosen = pickAllocationForRequest(
      [
        { id: 'alloc-1', allocatedQty: 10, takenQty: 8 }, // 2 remaining
        { id: 'alloc-2', allocatedQty: 10, takenQty: 0 }, // 10 remaining
      ],
      5,
    );
    expect(chosen).toBe('alloc-2');
  });

  it('returns null when no candidate has enough remaining', () => {
    const chosen = pickAllocationForRequest(
      [
        { id: 'alloc-1', allocatedQty: 10, takenQty: 8 },
        { id: 'alloc-2', allocatedQty: 5, takenQty: 5 },
      ],
      5,
    );
    expect(chosen).toBeNull();
  });

  it('returns null when there are no candidates at all', () => {
    expect(pickAllocationForRequest([], 1)).toBeNull();
  });

  it('accepts a candidate whose remaining exactly equals the request duration', () => {
    const chosen = pickAllocationForRequest(
      [{ id: 'alloc-1', allocatedQty: 5, takenQty: 0 }],
      5,
    );
    expect(chosen).toBe('alloc-1');
  });
});

// ---------------------------------------------------------------------------
// T4 — a type that does not require an allocation skips the balance check.
// ---------------------------------------------------------------------------
describe('rule T4: requiresAllocation: false skips the balance check', () => {
  it('never needs an allocation when the type does not require one', () => {
    expect(requestNeedsAllocation(false)).toBe(false);
  });

  it('needs an allocation when the type requires one', () => {
    expect(requestNeedsAllocation(true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T5 — balance moves only on approval; refusing/cancelling an approved
// request returns the days.
// ---------------------------------------------------------------------------
describe('rule T5: refusing/cancelling an approved request returns the days', () => {
  it('remaining goes back up once a previously-approved request is refused', async () => {
    const requests: FakeRequest[] = [
      { id: 'r1', allocationId: 'alloc-1', status: 'APPROVED', duration: 4 },
    ];
    const client = fakeClient(requests);
    const allocation = {
      id: 'alloc-1',
      allocatedQty: 10,
      status: 'APPROVED' as TimeOffStatus,
    };

    const before = deriveBalance(
      allocation.status,
      allocation.allocatedQty,
      await sumApprovedDuration(client, allocation.id),
    );
    expect(before.remainingQty).toBe(6);

    // The refuse endpoint flips status to REFUSED and clears allocationId.
    requests[0]!.status = 'REFUSED';
    requests[0]!.allocationId = null;

    const after = deriveBalance(
      allocation.status,
      allocation.allocatedQty,
      await sumApprovedDuration(client, allocation.id),
    );
    expect(after.remainingQty).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// T9 — a request outside the allocation's validFrom..validTo cannot consume
// it.
// ---------------------------------------------------------------------------
describe('rule T9: a request outside the allocation window cannot consume it', () => {
  it('covers a request fully inside an open-ended allocation', () => {
    const allocation = { validFrom: day('2026-01-01'), validTo: null };
    expect(
      allocationCoversWindow(allocation, day('2026-03-01'), day('2026-03-05')),
    ).toBe(true);
  });

  it('covers a request that lands exactly on the validity boundaries', () => {
    const allocation = {
      validFrom: day('2026-01-01'),
      validTo: day('2026-12-31'),
    };
    expect(
      allocationCoversWindow(allocation, day('2026-01-01'), day('2026-12-31')),
    ).toBe(true);
  });

  it('rejects a request that starts before the allocation is valid', () => {
    const allocation = { validFrom: day('2026-06-01'), validTo: null };
    expect(
      allocationCoversWindow(allocation, day('2026-05-15'), day('2026-06-10')),
    ).toBe(false);
  });

  it('rejects a request that ends after the allocation expires', () => {
    const allocation = {
      validFrom: day('2026-01-01'),
      validTo: day('2026-06-30'),
    };
    expect(
      allocationCoversWindow(allocation, day('2026-06-20'), day('2026-07-05')),
    ).toBe(false);
  });
});
