import { describe, expect, it } from 'vitest';

import {
  deriveStatus,
  endOfDay,
  isLateCheckIn,
  minutesToHours,
  overtimeMinutes,
  weekdayOf,
  workedMinutes,
} from './worked-hours.js';

const at = (hour: number, minute = 0): Date =>
  new Date(2026, 5, 15, hour, minute, 0, 0); // 2026-06-15 is a Monday

describe('workedMinutes', () => {
  it('subtracts the scheduled break from the span (rule A1)', () => {
    expect(workedMinutes(at(9), at(18), 60)).toBe(8 * 60);
  });

  it('floors at zero when the break exceeds the span', () => {
    expect(workedMinutes(at(9), at(9, 30), 45)).toBe(0);
  });

  it('rounds a fractional span to the nearest minute', () => {
    const checkIn = new Date(2026, 5, 15, 9, 0, 0, 0);
    const checkOut = new Date(2026, 5, 15, 9, 0, 30, 500); // 30.5s
    expect(workedMinutes(checkIn, checkOut, 0)).toBe(1);
  });
});

describe('minutesToHours', () => {
  it('converts to hours at two decimal places', () => {
    expect(minutesToHours(90)).toBe(1.5);
    expect(minutesToHours(100)).toBe(1.67);
    expect(minutesToHours(0)).toBe(0);
  });
});

describe('overtimeMinutes', () => {
  it('is zero when worked does not exceed expected (rule A2)', () => {
    expect(overtimeMinutes(400, 480)).toBe(0);
    expect(overtimeMinutes(480, 480)).toBe(0);
  });

  it('is the excess over expected minutes', () => {
    expect(overtimeMinutes(540, 480)).toBe(60);
  });
});

describe('isLateCheckIn', () => {
  it('is on time exactly at the scheduled start', () => {
    expect(isLateCheckIn(at(9, 0), 9 * 60)).toBe(false);
  });

  it('is on time within the 10 minute grace window (rule A6)', () => {
    expect(isLateCheckIn(at(9, 10), 9 * 60)).toBe(false);
  });

  it('is late one minute past the grace window', () => {
    expect(isLateCheckIn(at(9, 11), 9 * 60)).toBe(true);
  });

  it('is never late when there is no scheduled start', () => {
    expect(isLateCheckIn(at(23, 0), null)).toBe(false);
  });

  it('respects a custom grace period', () => {
    expect(isLateCheckIn(at(9, 20), 9 * 60, 30)).toBe(false);
    expect(isLateCheckIn(at(9, 31), 9 * 60, 30)).toBe(true);
  });
});

describe('weekdayOf', () => {
  it('maps Date#getDay() onto the shared Weekday enum', () => {
    expect(weekdayOf(new Date(2026, 5, 15))).toBe('MONDAY'); // Mon
    expect(weekdayOf(new Date(2026, 5, 14))).toBe('SUNDAY'); // Sun
    expect(weekdayOf(new Date(2026, 5, 20))).toBe('SATURDAY'); // Sat
  });
});

describe('endOfDay', () => {
  it('returns 23:59:59.999 on the same calendar day', () => {
    const end = endOfDay(at(9, 30));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getDate()).toBe(15);
  });
});

describe('deriveStatus', () => {
  it('is PRESENT for an on-time, closed session', () => {
    expect(
      deriveStatus({
        checkIn: at(9, 0),
        checkOut: at(18, 0),
        scheduledStartMinute: 9 * 60,
      }),
    ).toBe('PRESENT');
  });

  it('is LATE when the check-in misses the grace window (rule A6)', () => {
    expect(
      deriveStatus({
        checkIn: at(9, 25),
        checkOut: at(18, 0),
        scheduledStartMinute: 9 * 60,
      }),
    ).toBe('LATE');
  });

  it('is MISSING_CHECKOUT once the day has ended with no checkout (rule A4)', () => {
    expect(
      deriveStatus({
        checkIn: at(9, 0),
        checkOut: null,
        scheduledStartMinute: 9 * 60,
        now: new Date(2026, 5, 16, 1, 0), // next day
      }),
    ).toBe('MISSING_CHECKOUT');
  });

  it('is still PRESENT/LATE while the same day has not ended yet', () => {
    expect(
      deriveStatus({
        checkIn: at(9, 0),
        checkOut: null,
        scheduledStartMinute: 9 * 60,
        now: at(12, 0),
      }),
    ).toBe('PRESENT');
  });

  it('is ABSENT for a zero-length manual session', () => {
    expect(
      deriveStatus({
        checkIn: at(9, 0),
        checkOut: at(9, 0),
        scheduledStartMinute: 9 * 60,
      }),
    ).toBe('ABSENT');
  });
});
