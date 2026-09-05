import { type AttendanceStatus, type Weekday } from '@payz/shared';

/**
 * The maths behind rules A1, A2, A4 and A6: worked hours, overtime and the
 * derived status. Kept free of Prisma so unit tests can exercise every branch
 * without a database.
 */

/** Rule A6: a check-in inside this many minutes of the scheduled start is on time. */
export const LATE_GRACE_MINUTES = 10;

/**
 * Worked minutes for one session: (checkOut - checkIn - scheduledBreak),
 * floored at zero (rule A1). Mirrors `lineMinutes` in the schedules module —
 * a break that swallows the whole span must never go negative.
 */
export function workedMinutes(
  checkIn: Date,
  checkOut: Date,
  scheduledBreakMinutes: number,
): number {
  const spanMinutes = Math.round(
    (checkOut.getTime() - checkIn.getTime()) / 60_000,
  );
  const raw = spanMinutes - scheduledBreakMinutes;
  return raw > 0 ? raw : 0;
}

/** Minutes to hours at 2dp — the precision `AttendanceRow` reports (rule A1). */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Rule A2: minutes worked beyond what the weekday's schedule expected. */
export function overtimeMinutes(worked: number, expected: number): number {
  const diff = worked - expected;
  return diff > 0 ? diff : 0;
}

/**
 * Rule A6: late if the check-in falls after the scheduled start plus the
 * grace period. A day with no scheduled start (a day off, or no schedule at
 * all) can never be "late" — there is nothing to be late against.
 */
export function isLateCheckIn(
  checkIn: Date,
  scheduledStartMinute: number | null,
  graceMinutes: number = LATE_GRACE_MINUTES,
): boolean {
  if (scheduledStartMinute === null) {
    return false;
  }
  const minuteOfDay = checkIn.getHours() * 60 + checkIn.getMinutes();
  return minuteOfDay > scheduledStartMinute + graceMinutes;
}

const WEEKDAY_BY_JS_DAY: Record<number, Weekday> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};

/** `Date#getDay()` (0 = Sunday) mapped onto the shared `Weekday` enum. */
export function weekdayOf(date: Date): Weekday {
  const weekday = WEEKDAY_BY_JS_DAY[date.getDay()];
  if (weekday === undefined) {
    // getDay() only ever returns 0..6; reaching here means the platform Date
    // implementation lied to us.
    throw new Error('Unreachable: Date#getDay() returned an invalid index');
  }
  return weekday;
}

/** Midnight-to-midnight end of the calendar day `date` falls on. */
export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export interface DeriveStatusInput {
  checkIn: Date;
  checkOut: Date | null;
  /** Minutes from midnight the weekday's schedule line starts, or null on a day off / no schedule. */
  scheduledStartMinute: number | null;
  /** Injectable for tests; defaults to the real clock. */
  now?: Date;
}

/**
 * Rules A4 and A6, combined into the one status the row carries.
 *
 * There is deliberately no `status` field on `attendanceSchema` — rule A1
 * keeps every derived figure out of client hands — so a manual record with a
 * zero-length session (checkOut equal to checkIn) is HR's way of logging a
 * no-show for the day; it is the one shape a check-in/check-out pair can take
 * that unambiguously means ABSENT rather than a very short PRESENT visit.
 */
export function deriveStatus(input: DeriveStatusInput): AttendanceStatus {
  const { checkIn, checkOut, scheduledStartMinute } = input;

  if (checkOut !== null && checkOut.getTime() === checkIn.getTime()) {
    return 'ABSENT';
  }

  if (checkOut === null) {
    const now = input.now ?? new Date();
    if (now.getTime() > endOfDay(checkIn).getTime()) {
      return 'MISSING_CHECKOUT';
    }
  }

  return isLateCheckIn(checkIn, scheduledStartMinute) ? 'LATE' : 'PRESENT';
}
