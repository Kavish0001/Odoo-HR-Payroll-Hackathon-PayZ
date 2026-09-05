import { type PrismaClient } from '@prisma/client';

import { prisma as defaultPrisma } from '../../config/prisma.js';

import { endOfDay } from './worked-hours.js';

/**
 * A check-in with no check-out is only a live session on the day it happened.
 *
 * Left alone, a forgotten punch is worse than a missing figure: the partial
 * unique index allows one open row per employee, so a record still open from
 * three weeks ago silently prevents that person from ever checking in again,
 * and the widget reports an elapsed time in the tens of thousands of minutes.
 *
 * So a stale row is closed at the end of its own day and flagged
 * MISSING_CHECKOUT with no worked time, which is what it is: a data quality
 * problem for someone to correct, not time anybody worked (rule A4).
 */

export type StaleSessionClient = Pick<PrismaClient, 'attendance'>;

/** Midnight this morning, in the server's timezone. */
export function startOfToday(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Closes any open attendance row that began before today.
 *
 * Returns how many were closed, so a caller can tell the difference between
 * "nothing to do" and "we just tidied up after a forgotten punch".
 */
export async function closeStaleSessions(
  employeeId: string,
  now: Date = new Date(),
  client: StaleSessionClient = defaultPrisma,
): Promise<number> {
  const stale = await client.attendance.findMany({
    where: { employeeId, checkOut: null, checkIn: { lt: startOfToday(now) } },
    select: { id: true, checkIn: true },
  });

  for (const row of stale) {
    await client.attendance.update({
      where: { id: row.id },
      data: {
        checkOut: endOfDay(row.checkIn),
        workedMinutes: 0,
        overtimeMinutes: 0,
        status: 'MISSING_CHECKOUT',
      },
    });
  }

  return stale.length;
}

/** The open row for today, if there is one. Older rows are never live. */
export async function findLiveSession(
  employeeId: string,
  now: Date = new Date(),
  client: StaleSessionClient = defaultPrisma,
): Promise<{ id: string; checkIn: Date } | null> {
  return client.attendance.findFirst({
    where: {
      employeeId,
      checkOut: null,
      checkIn: { gte: startOfToday(now) },
    },
    select: { id: true, checkIn: true },
    orderBy: { checkIn: 'desc' },
  });
}
