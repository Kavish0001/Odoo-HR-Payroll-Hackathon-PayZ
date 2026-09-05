import { type PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from '../../config/prisma.js';
import { resolvePeriodContract } from '../contracts/resolve-period-contract.js';
import { type ScheduleLineLike } from '../schedules/weekly-hours.js';

/**
 * Rule A2: the schedule that governs a day's expected hours is the one on
 * whichever RUNNING contract applies that day — falling back to the
 * employee's own `workingScheduleId` only when no contract (or a contract
 * with no schedule of its own) applies. Reuses `resolvePeriodContract` (rule
 * C2) rather than re-implementing the overlap test.
 */
export type ScheduleLookupClient = Pick<
  PrismaClient,
  'contract' | 'employee' | 'scheduleLine'
>;

export async function resolveScheduleLines(
  employeeId: string,
  onDate: Date,
  client: ScheduleLookupClient = defaultPrisma,
): Promise<readonly ScheduleLineLike[]> {
  const contract = await resolvePeriodContract(
    employeeId,
    onDate,
    onDate,
    client,
  );

  let scheduleId = contract?.workingScheduleId ?? null;

  if (scheduleId === null) {
    const employee = await client.employee.findUnique({
      where: { id: employeeId },
      select: { workingScheduleId: true },
    });
    scheduleId = employee?.workingScheduleId ?? null;
  }

  if (scheduleId === null) {
    return [];
  }

  return client.scheduleLine.findMany({ where: { scheduleId } });
}
