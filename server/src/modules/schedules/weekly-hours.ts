import { type Weekday } from '@payz/shared';

/**
 * The maths behind rule S1: weekly hours and days-per-week are derived from
 * schedule lines and must never be read from a stored column or accepted
 * from the client.
 */

export interface ScheduleLineLike {
  dayOfWeek: Weekday;
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
}

/**
 * Minutes actually worked by one line: (end - start - break).
 *
 * Floored at zero so a line whose break equals or exceeds its span never
 * produces a negative contribution to the weekly total. The DB constraint and
 * the shared Zod schema both already reject this at input time (rule S2), but
 * this function stays defensive for data that predates those guards or that
 * arrives from a source other than the validated form.
 */
export function lineMinutes(line: ScheduleLineLike): number {
  const raw = line.endMinute - line.startMinute - line.breakMinutes;
  return raw > 0 ? raw : 0;
}

/** Sum of worked minutes across every line of the schedule. */
export function weeklyMinutes(lines: readonly ScheduleLineLike[]): number {
  return lines.reduce((total, line) => total + lineMinutes(line), 0);
}

/** Weekly hours, derived — never stored (rule S1). */
export function weeklyHours(lines: readonly ScheduleLineLike[]): number {
  return weeklyMinutes(lines) / 60;
}

/** Count of weekdays that actually carry working time. */
export function daysPerWeek(lines: readonly ScheduleLineLike[]): number {
  const workingDays = new Set(
    lines.filter((line) => lineMinutes(line) > 0).map((line) => line.dayOfWeek),
  );
  return workingDays.size;
}

/**
 * Expected worked minutes for one weekday of a schedule.
 *
 * No line for that weekday means a non-working day (rule S4), so it returns
 * zero rather than throwing — attendance and payroll both treat "no line" as
 * "nothing was expected" rather than an error.
 */
export function expectedMinutesForWeekday(
  schedule: readonly ScheduleLineLike[],
  weekday: Weekday,
): number {
  const line = schedule.find((candidate) => candidate.dayOfWeek === weekday);
  return line === undefined ? 0 : lineMinutes(line);
}
