import {
  attendanceQuerySchema,
  attendanceSchema,
  type AttendanceQuery,
  type AttendanceRow,
  type AttendanceSession,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router, type Request } from 'express';
import { type z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  mustBeSelf,
  requireAuth,
  requirePermission,
  requireRole,
  selfScope,
} from '../../middleware/auth.js';
import { conflict, forbidden, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';
import { expectedMinutesForWeekday } from '../schedules/weekly-hours.js';

import { resolveScheduleLines } from './resolve-schedule-lines.js';
import {
  deriveStatus,
  endOfDay,
  minutesToHours,
  overtimeMinutes,
  weekdayOf,
  workedMinutes,
} from './worked-hours.js';

export const attendanceRouter: Router = Router();

const attendanceWithEmployee = Prisma.validator<Prisma.AttendanceDefaultArgs>()({
  include: {
    employee: {
      select: {
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
      },
    },
  },
});
type AttendanceWithEmployee = Prisma.AttendanceGetPayload<
  typeof attendanceWithEmployee
>;

function toRow(attendance: AttendanceWithEmployee): AttendanceRow {
  return {
    id: attendance.id,
    employeeId: attendance.employeeId,
    employeeName: `${attendance.employee.firstName} ${attendance.employee.lastName}`,
    departmentName: attendance.employee.department?.name ?? null,
    checkIn: attendance.checkIn.toISOString(),
    checkOut:
      attendance.checkOut === null ? null : attendance.checkOut.toISOString(),
    // Derived from the times and the schedule; never accepted from a client
    // (rule A1) — recomputed by `computeAttendanceFields` on every write.
    workedHours: minutesToHours(attendance.workedMinutes),
    overtimeHours: minutesToHours(attendance.overtimeMinutes),
    status: attendance.status,
    source: attendance.source,
    manuallyEdited: attendance.source === 'MANUAL',
    notes: attendance.notes,
  };
}

interface ComputedAttendanceFields {
  workedMinutes: number;
  overtimeMinutes: number;
  status: AttendanceRow['status'];
}

/**
 * Rules A1, A2, A4 and A6 in one place: looks up the schedule that governs
 * `checkIn`'s weekday (contract wins over employee schedule, rule A2) and
 * derives worked minutes, overtime minutes and status from it. Every mutating
 * route below goes through this rather than trusting anything the client sent
 * for these fields.
 */
async function computeAttendanceFields(
  employeeId: string,
  checkIn: Date,
  checkOut: Date | null,
  now: Date = new Date(),
): Promise<ComputedAttendanceFields> {
  const lines = await resolveScheduleLines(employeeId, checkIn);
  const weekday = weekdayOf(checkIn);
  const scheduledLine = lines.find((line) => line.dayOfWeek === weekday);
  const scheduledBreakMinutes = scheduledLine?.breakMinutes ?? 0;
  const scheduledStartMinute = scheduledLine?.startMinute ?? null;
  const expectedMinutes = expectedMinutesForWeekday(lines, weekday);

  const worked =
    checkOut === null ? 0 : workedMinutes(checkIn, checkOut, scheduledBreakMinutes);
  const overtime = overtimeMinutes(worked, expectedMinutes);
  const status = deriveStatus({ checkIn, checkOut, scheduledStartMinute, now });

  return { workedMinutes: worked, overtimeMinutes: overtime, status };
}

/** Rule A3: the partial unique index that allows at most one open session per employee. */
function translateAttendanceError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.['target'];
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';
    if (targetText.includes('attendances_one_open_session')) {
      return conflict('This employee already has an open attendance session');
    }
    return conflict('A conflicting attendance record already exists');
  }
  return error;
}

function requireEmployeeId(req: Request): string {
  const user = getUser(req);
  if (user.employeeId === null) {
    throw forbidden('This account is not linked to an employee record');
  }
  return user.employeeId;
}

const CLOSED_SESSION: AttendanceSession = {
  open: false,
  attendanceId: null,
  checkInAt: null,
  elapsedMinutes: 0,
};

// ---------------------------------------------------------------------------
// GET / — paginated list (rule R2: EMPLOYEE sees only their own records)
// ---------------------------------------------------------------------------

attendanceRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'attendance'),
  validate({ query: attendanceQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as AttendanceQuery;

    const where: Prisma.AttendanceWhereInput = {};
    if (query.employeeId !== undefined) {
      where.employeeId = query.employeeId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    const checkInFilter: Prisma.DateTimeFilter<'Attendance'> = {};
    if (query.from !== undefined) {
      checkInFilter.gte = query.from;
    }
    if (query.to !== undefined) {
      checkInFilter.lte = endOfDay(query.to);
    }
    if (Object.keys(checkInFilter).length > 0) {
      where.checkIn = checkInFilter;
    }

    // R2: applied last so it always wins over whatever the client passed.
    Object.assign(where, selfScope(req));

    const [rows, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        ...attendanceWithEmployee,
        ...paginationArgs(query),
        orderBy: { checkIn: 'desc' },
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json(toPaginated(rows.map(toRow), total, query));
  }),
);

// ---------------------------------------------------------------------------
// Widget: GET /session, POST /check-in, POST /check-out
//
// Registered ahead of GET/PATCH/DELETE '/:id' so '/session' etc. never match
// the ':id' pattern first.
// ---------------------------------------------------------------------------

attendanceRouter.get(
  '/session',
  requireAuth,
  requirePermission('read', 'attendance'),
  asyncRoute(async (req, res) => {
    const employeeId = requireEmployeeId(req);

    const open = await prisma.attendance.findFirst({
      where: { employeeId, checkOut: null },
    });

    if (open === null) {
      res.json(CLOSED_SESSION);
      return;
    }

    const elapsedMinutes = Math.max(
      0,
      Math.floor((Date.now() - open.checkIn.getTime()) / 60_000),
    );

    const session: AttendanceSession = {
      open: true,
      attendanceId: open.id,
      checkInAt: open.checkIn.toISOString(),
      elapsedMinutes,
    };
    res.json(session);
  }),
);

attendanceRouter.post(
  '/check-in',
  requireAuth,
  // The matrix grants EMPLOYEE 'create' on attendance for exactly this
  // self-service action (rule A5 restricts only the *manual* create/edit
  // endpoints below to HR_MANAGER+).
  requirePermission('create', 'attendance'),
  asyncRoute(async (req, res) => {
    const employeeId = requireEmployeeId(req);
    const checkIn = new Date();

    const computed = await computeAttendanceFields(employeeId, checkIn, null);

    try {
      const created = await prisma.attendance.create({
        data: {
          employeeId,
          checkIn,
          checkOut: null,
          workedMinutes: computed.workedMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          status: computed.status,
          source: 'WIDGET',
        },
      });

      const session: AttendanceSession = {
        open: true,
        attendanceId: created.id,
        checkInAt: created.checkIn.toISOString(),
        elapsedMinutes: 0,
      };
      res.status(201).json(session);
    } catch (error) {
      throw translateAttendanceError(error);
    }
  }),
);

attendanceRouter.post(
  '/check-out',
  requireAuth,
  requirePermission('create', 'attendance'),
  asyncRoute(async (req, res) => {
    const employeeId = requireEmployeeId(req);

    const open = await prisma.attendance.findFirst({
      where: { employeeId, checkOut: null },
    });
    if (open === null) {
      throw conflict('No open attendance session to check out of');
    }

    const checkOut = new Date();
    const computed = await computeAttendanceFields(
      employeeId,
      open.checkIn,
      checkOut,
    );

    await prisma.attendance.update({
      where: { id: open.id },
      data: {
        checkOut,
        workedMinutes: computed.workedMinutes,
        overtimeMinutes: computed.overtimeMinutes,
        status: computed.status,
      },
    });

    res.json(CLOSED_SESSION);
  }),
);

// ---------------------------------------------------------------------------
// GET /:id
// ---------------------------------------------------------------------------

attendanceRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'attendance'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const attendance = await prisma.attendance.findUnique({
      where: { id },
      ...attendanceWithEmployee,
    });
    if (attendance === null) {
      throw notFound('Attendance record not found');
    }
    mustBeSelf(req, attendance.employeeId);

    res.json(toRow(attendance));
  }),
);

// ---------------------------------------------------------------------------
// POST / — manual create (rule A5: HR_MANAGER+ only, stamps source MANUAL)
// ---------------------------------------------------------------------------

attendanceRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'attendance'),
  requireRole('HR_MANAGER'),
  validate({ body: attendanceSchema }),
  asyncRoute(async (req, res) => {
    const user = getUser(req);
    const body = req.body as z.infer<typeof attendanceSchema>;
    const checkOut = body.checkOut ?? null;

    const computed = await computeAttendanceFields(
      body.employeeId,
      body.checkIn,
      checkOut,
    );

    try {
      const created = await prisma.attendance.create({
        data: {
          employeeId: body.employeeId,
          checkIn: body.checkIn,
          checkOut,
          notes: body.notes ?? null,
          workedMinutes: computed.workedMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          status: computed.status,
          source: 'MANUAL',
          editedByUserId: user.id,
        },
        ...attendanceWithEmployee,
      });
      res.status(201).json(toRow(created));
    } catch (error) {
      throw translateAttendanceError(error);
    }
  }),
);

// ---------------------------------------------------------------------------
// PATCH /:id — manual edit (rule A5: HR_MANAGER+ only via the permission
// matrix, which already sets 'update' on attendance to HR_MANAGER)
// ---------------------------------------------------------------------------

attendanceRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'attendance'),
  validate({ params: idParamsSchema, body: attendanceSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const user = getUser(req);
    const body = req.body as z.infer<typeof attendanceSchema>;
    const checkOut = body.checkOut ?? null;

    const computed = await computeAttendanceFields(
      body.employeeId,
      body.checkIn,
      checkOut,
    );

    try {
      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          employeeId: body.employeeId,
          checkIn: body.checkIn,
          checkOut,
          notes: body.notes ?? null,
          workedMinutes: computed.workedMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          status: computed.status,
          source: 'MANUAL',
          editedByUserId: user.id,
        },
        ...attendanceWithEmployee,
      });
      res.json(toRow(updated));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Attendance record not found');
      }
      throw translateAttendanceError(error);
    }
  }),
);

// ---------------------------------------------------------------------------
// DELETE /:id
// ---------------------------------------------------------------------------

attendanceRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'attendance'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    try {
      await prisma.attendance.delete({ where: { id } });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Attendance record not found');
      }
      throw error;
    }
  }),
);
