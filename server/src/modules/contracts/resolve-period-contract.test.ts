import { type Contract, type ContractStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  type ContractLookupClient,
  isApplicableToPeriod,
  resolvePeriodContract,
} from './resolve-period-contract.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

/** The one employee these fixtures are about. */
const EMPLOYEE = 1;

let counter = 0;

function makeContract(overrides: {
  status: ContractStatus;
  startDate: Date;
  endDate: Date | null;
}): Contract {
  counter += 1;
  return {
    id: counter,
    reference: `CON/${counter}`,
    employeeId: EMPLOYEE,
    wageMonthly: 5_000_00,
    departmentId: null,
    jobPositionId: null,
    workingScheduleId: null,
    salaryStructureId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function clientReturning(contracts: Contract[]): ContractLookupClient {
  return {
    contract: {
      findMany: vi.fn().mockResolvedValue(contracts),
    },
  } as unknown as ContractLookupClient;
}

describe('isApplicableToPeriod', () => {
  const periodStart = day('2026-02-01');
  const periodEnd = day('2026-02-28');

  it('matches a RUNNING contract that starts mid-period', () => {
    const contract = makeContract({
      status: 'RUNNING',
      startDate: day('2026-02-15'),
      endDate: null,
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(true);
  });

  it('matches a RUNNING contract that ends mid-period', () => {
    const contract = makeContract({
      status: 'RUNNING',
      startDate: day('2026-01-01'),
      endDate: day('2026-02-10'),
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(true);
  });

  it('matches an open-ended RUNNING contract that started before the period', () => {
    const contract = makeContract({
      status: 'RUNNING',
      startDate: day('2025-06-01'),
      endDate: null,
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(true);
  });

  it('does not match a contract that ended before the period started', () => {
    const contract = makeContract({
      status: 'RUNNING',
      startDate: day('2025-01-01'),
      endDate: day('2026-01-15'),
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(false);
  });

  it('does not match a contract that starts after the period ends', () => {
    const contract = makeContract({
      status: 'RUNNING',
      startDate: day('2026-03-01'),
      endDate: null,
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(false);
  });

  it('does not match an EXPIRED contract even though its dates overlap the period', () => {
    const contract = makeContract({
      status: 'EXPIRED',
      startDate: day('2026-01-01'),
      endDate: day('2026-02-20'),
    });
    expect(isApplicableToPeriod(contract, periodStart, periodEnd)).toBe(false);
  });
});

describe('resolvePeriodContract', () => {
  const periodStart = day('2026-02-01');
  const periodEnd = day('2026-02-28');

  it('returns the RUNNING contract starting mid-period', () => {
    const midStart = makeContract({
      status: 'RUNNING',
      startDate: day('2026-02-10'),
      endDate: null,
    });
    const client = clientReturning([midStart]);

    return resolvePeriodContract(EMPLOYEE, periodStart, periodEnd, client).then(
      (result) => {
        expect(result?.id).toBe(midStart.id);
      },
    );
  });

  it('returns the RUNNING contract ending mid-period', async () => {
    const midEnd = makeContract({
      status: 'RUNNING',
      startDate: day('2025-11-01'),
      endDate: day('2026-02-12'),
    });
    const client = clientReturning([midEnd]);

    const result = await resolvePeriodContract(
      EMPLOYEE,
      periodStart,
      periodEnd,
      client,
    );
    expect(result?.id).toBe(midEnd.id);
  });

  it('returns an open-ended RUNNING contract', async () => {
    const openEnded = makeContract({
      status: 'RUNNING',
      startDate: day('2025-01-01'),
      endDate: null,
    });
    const client = clientReturning([openEnded]);

    const result = await resolvePeriodContract(
      EMPLOYEE,
      periodStart,
      periodEnd,
      client,
    );
    expect(result?.id).toBe(openEnded.id);
  });

  it('returns null when no contract applies to the period', async () => {
    const tooEarly = makeContract({
      status: 'RUNNING',
      startDate: day('2024-01-01'),
      endDate: day('2024-12-31'),
    });
    const client = clientReturning([tooEarly]);

    const result = await resolvePeriodContract(
      EMPLOYEE,
      periodStart,
      periodEnd,
      client,
    );
    expect(result).toBeNull();
  });

  it('does not select an expired contract whose dates would otherwise overlap', async () => {
    const expired = makeContract({
      status: 'EXPIRED',
      startDate: day('2026-01-01'),
      endDate: day('2026-02-15'),
    });
    const client = clientReturning([expired]);

    const result = await resolvePeriodContract(
      EMPLOYEE,
      periodStart,
      periodEnd,
      client,
    );
    expect(result).toBeNull();
  });

  it('picks the applicable contract out of several on the employee history', async () => {
    const old = makeContract({
      status: 'EXPIRED',
      startDate: day('2024-01-01'),
      endDate: day('2025-12-31'),
    });
    const current = makeContract({
      status: 'RUNNING',
      startDate: day('2026-01-01'),
      endDate: null,
    });
    const client = clientReturning([old, current]);

    const result = await resolvePeriodContract(
      EMPLOYEE,
      periodStart,
      periodEnd,
      client,
    );
    expect(result?.id).toBe(current.id);
  });
});
