import { type PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from '../../config/prisma.js';

/**
 * Turns raw attendance rows for one employee's period into what the payroll
 * engine needs (`ComputeInput['worked']`).
 *
 * Real attendance in the seed data only runs through the day the demo was
 * cut, so a period with no rows at all (a future month, or a period nobody
 * has clocked into yet) falls back to the calendar's working days rather
 * than producing a payslip worth zero — a payrun must stay computable before
 * attendance exists for it.
 */

export interface WorkedFacts {
  days: number;
  minutes: number;
  leaveDays: number;
  overtimeMinutes: number;
}

export type AttendanceLookupClient = Pick<PrismaClient, 'attendance'>;

function isWeekend(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** Count of Mon-Fri calendar days in [start, end], inclusive. */
export function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (!isWeekend(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

const STANDARD_DAY_MINUTES = 480;

export async function computeWorkedFacts(
  employeeId: number,
  periodStart: Date,
  periodEnd: Date,
  client: AttendanceLookupClient = defaultPrisma,
): Promise<WorkedFacts> {
  // periodEnd is midnight UTC of the last day; a check-in on that day is
  // still within the period, so the upper bound is the start of the next day.
  const exclusiveEnd = new Date(periodEnd);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);

  const rows = await client.attendance.findMany({
    where: {
      employeeId,
      checkIn: { gte: periodStart, lt: exclusiveEnd },
    },
    select: { workedMinutes: true, overtimeMinutes: true, status: true },
  });

  if (rows.length === 0) {
    const workingDays = countWeekdays(periodStart, periodEnd);
    return {
      days: workingDays,
      minutes: workingDays * STANDARD_DAY_MINUTES,
      leaveDays: 0,
      overtimeMinutes: 0,
    };
  }

  let minutes = 0;
  let overtimeMinutes = 0;
  let leaveDays = 0;
  let days = 0;

  for (const row of rows) {
    if (row.status === 'ABSENT') {
      leaveDays += 1;
      continue;
    }
    days += 1;
    minutes += row.workedMinutes;
    overtimeMinutes += row.overtimeMinutes;
  }

  return { days, minutes, leaveDays, overtimeMinutes };
}
