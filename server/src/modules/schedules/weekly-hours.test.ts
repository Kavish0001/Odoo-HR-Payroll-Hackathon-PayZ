import { describe, expect, it } from 'vitest';

import {
  daysPerWeek,
  expectedMinutesForWeekday,
  lineMinutes,
  weeklyHours,
  weeklyMinutes,
} from './weekly-hours.js';
import { type ScheduleLineLike } from './weekly-hours.js';

const line = (
  dayOfWeek: ScheduleLineLike['dayOfWeek'],
  startMinute: number,
  endMinute: number,
  breakMinutes = 0,
): ScheduleLineLike => ({ dayOfWeek, startMinute, endMinute, breakMinutes });

describe('lineMinutes', () => {
  it('subtracts the break from the span', () => {
    expect(lineMinutes(line('MONDAY', 9 * 60, 18 * 60, 60))).toBe(8 * 60);
  });

  it('floors at zero when the break is longer than the working day', () => {
    // 9:00-9:30 with a 45 minute break would be negative; must clamp to 0.
    expect(lineMinutes(line('MONDAY', 9 * 60, 9 * 60 + 30, 45))).toBe(0);
  });

  it('floors at zero when the break exactly equals the span', () => {
    expect(lineMinutes(line('MONDAY', 9 * 60, 10 * 60, 60))).toBe(0);
  });
});

describe('weeklyMinutes / weeklyHours', () => {
  it('sums a standard 5-day, 9-to-6-with-an-hour-break week to 40 hours', () => {
    const lines = (
      ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const
    ).map((day) => line(day, 9 * 60, 18 * 60, 60));

    expect(weeklyMinutes(lines)).toBe(5 * 8 * 60);
    expect(weeklyHours(lines)).toBe(40);
  });

  it('ignores a line whose break swallows the whole day when totalling', () => {
    const lines = [
      line('MONDAY', 9 * 60, 18 * 60, 60),
      line('TUESDAY', 9 * 60, 9 * 60 + 30, 45),
    ];

    expect(weeklyMinutes(lines)).toBe(8 * 60);
  });

  it('returns zero for a schedule with no lines', () => {
    expect(weeklyMinutes([])).toBe(0);
    expect(weeklyHours([])).toBe(0);
  });
});

describe('daysPerWeek', () => {
  it('counts one day per distinct working weekday', () => {
    const lines = [
      line('MONDAY', 9 * 60, 14 * 60),
      line('TUESDAY', 9 * 60, 14 * 60),
      line('WEDNESDAY', 9 * 60, 14 * 60),
      line('THURSDAY', 9 * 60, 14 * 60),
    ];
    expect(daysPerWeek(lines)).toBe(4);
  });

  it('does not count a day whose break consumes the entire span', () => {
    const lines = [
      line('MONDAY', 9 * 60, 18 * 60, 60),
      line('TUESDAY', 9 * 60, 9 * 60 + 30, 45),
    ];
    expect(daysPerWeek(lines)).toBe(1);
  });
});

describe('expectedMinutesForWeekday', () => {
  const schedule = [
    line('MONDAY', 9 * 60, 18 * 60, 60),
    line('TUESDAY', 9 * 60, 13 * 60, 0),
  ];

  it('returns the worked minutes for a day that has a line', () => {
    expect(expectedMinutesForWeekday(schedule, 'MONDAY')).toBe(8 * 60);
    expect(expectedMinutesForWeekday(schedule, 'TUESDAY')).toBe(4 * 60);
  });

  it('returns zero for a weekday with no line — a non-working day', () => {
    expect(expectedMinutesForWeekday(schedule, 'SUNDAY')).toBe(0);
  });

  it('returns zero when a break longer than the day is somehow present', () => {
    const withBadBreak = [line('SATURDAY', 9 * 60, 9 * 60 + 30, 45)];
    expect(expectedMinutesForWeekday(withBadBreak, 'SATURDAY')).toBe(0);
  });
});
