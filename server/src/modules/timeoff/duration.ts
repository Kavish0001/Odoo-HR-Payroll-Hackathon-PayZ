import { type Weekday } from '@payz/shared';
import { type PrismaClient } from '@prisma/client';

import { lineMinutes, type ScheduleLineLike } from '../schedules/weekly-hours.js';

/**
 * Rule T6: a request's duration is working days counted against the
 * employee's schedule, never raw calendar days.
 */

/** `Date#getUTCDay()` is 0 = Sunday; this maps that index to our enum. */
const WEEKDAY_BY_JS_DAY: readonly Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

/** The set of weekdays that actually carry working time in a schedule. */
export function workingWeekdays(
  lines: readonly ScheduleLineLike[],
): Set<Weekday> {
  return new Set(
    lines.filter((line) => lineMinutes(line) > 0).map((line) => line.dayOfWeek),
  );
}

function atMidnightUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Counts working days between `startDate` and `endDate`, inclusive.
 *
 * When the employee has no working schedule at all (`lines` is empty),
 * every calendar day is counted: with no known non-working pattern there is
 * nothing to exclude, and treating an unscheduled employee as never able to
 * take leave would be worse than over-counting.
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  lines: readonly ScheduleLineLike[],
): number {
  const working = workingWeekdays(lines);
  const treatEveryDayAsWorking = lines.length === 0;

  const cursor = atMidnightUtc(startDate);
  const end = atMidnightUtc(endDate);

  let count = 0;
  while (cursor.getTime() <= end.getTime()) {
    const weekday = WEEKDAY_BY_JS_DAY[cursor.getUTCDay()];
    if (
      treatEveryDayAsWorking ||
      (weekday !== undefined && working.has(weekday))
    ) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

/** The narrow client shape this needs, so callers can pass a `tx` too. */
export type ScheduleLookupClient = Pick<PrismaClient, 'employee'>;

/** The employee's schedule lines, or `[]` when they have no schedule assigned. */
export async function fetchEmployeeScheduleLines(
  client: ScheduleLookupClient,
  employeeId: string,
): Promise<ScheduleLineLike[]> {
  const employee = await client.employee.findUnique({
    where: { id: employeeId },
    select: {
      workingSchedule: {
        select: {
          lines: {
            select: {
              dayOfWeek: true,
              startMinute: true,
              endMinute: true,
              breakMinutes: true,
            },
          },
        },
      },
    },
  });
  return employee?.workingSchedule?.lines ?? [];
}
