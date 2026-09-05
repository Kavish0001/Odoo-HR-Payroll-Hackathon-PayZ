import {
  paginationSchema,
  workingScheduleSchema,
  type ScheduleLineRow,
  type WorkingScheduleRow,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { conflict, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { getDefaultCompanyId } from '../common/company.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

import { daysPerWeek, lineMinutes, weeklyHours } from './weekly-hours.js';

export const schedulesRouter: Router = Router();

const scheduleQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false']).optional(),
});
type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;

const scheduleWithRelations =
  Prisma.validator<Prisma.WorkingScheduleDefaultArgs>()({
    include: {
      lines: true,
      _count: { select: { employees: true } },
    },
  });
type ScheduleWithRelations = Prisma.WorkingScheduleGetPayload<
  typeof scheduleWithRelations
>;

function toLineRow(
  line: ScheduleWithRelations['lines'][number],
): ScheduleLineRow {
  return {
    id: line.id,
    dayOfWeek: line.dayOfWeek,
    startMinute: line.startMinute,
    endMinute: line.endMinute,
    breakMinutes: line.breakMinutes,
    hours: lineMinutes(line) / 60,
  };
}

function toRow(
  schedule: ScheduleWithRelations,
  includeLines: boolean,
): WorkingScheduleRow {
  return {
    id: schedule.id,
    name: schedule.name,
    calendarType: schedule.calendarType,
    timezone: schedule.timezone,
    active: schedule.active,
    daysPerWeek: daysPerWeek(schedule.lines),
    hoursPerWeek: weeklyHours(schedule.lines),
    employeeCount: schedule._count.employees,
    ...(includeLines ? { lines: schedule.lines.map(toLineRow) } : {}),
  };
}

schedulesRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'workingSchedule'),
  validate({ query: scheduleQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as ScheduleQuery;

    const where: Prisma.WorkingScheduleWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.name = containsInsensitive(query.search);
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [schedules, total] = await Promise.all([
      prisma.workingSchedule.findMany({
        where,
        ...scheduleWithRelations,
        ...paginationArgs(query),
        orderBy: { name: 'asc' },
      }),
      prisma.workingSchedule.count({ where }),
    ]);

    res.json(
      toPaginated(
        schedules.map((schedule) => toRow(schedule, false)),
        total,
        query,
      ),
    );
  }),
);

schedulesRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'workingSchedule'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const schedule = await prisma.workingSchedule.findUnique({
      where: { id },
      ...scheduleWithRelations,
    });
    if (schedule === null) {
      throw notFound('Working schedule not found');
    }

    res.json(toRow(schedule, true));
  }),
);

schedulesRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'workingSchedule'),
  validate({ body: workingScheduleSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof workingScheduleSchema>;
    const companyId = await getDefaultCompanyId();

    try {
      const schedule = await prisma.workingSchedule.create({
        data: {
          name: body.name,
          calendarType: body.calendarType,
          timezone: body.timezone,
          active: body.active,
          companyId,
          lines: { create: body.lines },
        },
        ...scheduleWithRelations,
      });
      res.status(201).json(toRow(schedule, true));
    } catch (error) {
      throw translateScheduleError(error, body.name);
    }
  }),
);

schedulesRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'workingSchedule'),
  validate({ params: idParamsSchema, body: workingScheduleSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const body = req.body as z.infer<typeof workingScheduleSchema>;

    try {
      // Lines are replaced wholesale rather than diffed: the form always
      // submits the complete day list, so a delete-then-recreate inside one
      // transaction is simpler than reconciling adds/edits/removes.
      const schedule = await prisma.$transaction(async (tx) => {
        await tx.scheduleLine.deleteMany({ where: { scheduleId: id } });
        return tx.workingSchedule.update({
          where: { id },
          data: {
            name: body.name,
            calendarType: body.calendarType,
            timezone: body.timezone,
            active: body.active,
            lines: { create: body.lines },
          },
          ...scheduleWithRelations,
        });
      });
      res.json(toRow(schedule, true));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Working schedule not found');
      }
      throw translateScheduleError(error, body.name);
    }
  }),
);

schedulesRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'workingSchedule'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    try {
      // Soft delete: contracts and employees already assigned keep their
      // schedule, and its hours stay derivable for payroll history.
      await prisma.workingSchedule.update({
        where: { id },
        data: { active: false },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Working schedule not found');
      }
      throw error;
    }
  }),
);

function translateScheduleError(error: unknown, name: string): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return conflict(`A working schedule named "${name}" already exists`);
  }
  return error;
}
