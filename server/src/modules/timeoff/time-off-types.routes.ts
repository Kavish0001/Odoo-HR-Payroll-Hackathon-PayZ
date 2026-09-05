import {
  paginationSchema,
  timeOffTypeSchema,
  type TimeOffTypeRow,
} from '@payz/shared';
import { Prisma, type TimeOffType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { conflict, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { containsInsensitive, paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

/**
 * Mount at `/api/time-off` — this router owns the `/types` and `/types/:id`
 * paths, so the endpoints land at exactly `/api/time-off/types[...]`
 * regardless of which other time-off router shares the prefix.
 */
export const timeOffTypesRouter: Router = Router();

const typeQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false']).optional(),
});
type TypeQuery = z.infer<typeof typeQuerySchema>;

function toRow(type: TimeOffType): TimeOffTypeRow {
  return {
    id: type.id,
    name: type.name,
    code: type.code,
    unit: type.unit,
    requiresAllocation: type.requiresAllocation,
    approvalLevel: type.approvalLevel,
    payrollWorkEntry: type.payrollWorkEntry,
    isPaid: type.isPaid,
    color: type.color,
    active: type.active,
  };
}

/**
 * Normalises the Zod-validated body to Prisma's shape: every nullable field
 * becomes an explicit `null` rather than `undefined`, which
 * `exactOptionalPropertyTypes` otherwise rejects when spread into `data`.
 */
function toTypeData(body: z.infer<typeof timeOffTypeSchema>) {
  return {
    name: body.name,
    code: body.code,
    unit: body.unit,
    requiresAllocation: body.requiresAllocation,
    approvalLevel: body.approvalLevel,
    payrollWorkEntry: body.payrollWorkEntry ?? null,
    isPaid: body.isPaid,
    color: body.color,
    active: body.active,
  };
}

function translateTypeError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.['target'];
    const field = Array.isArray(target) ? target.join(', ') : 'name or code';
    return conflict(`A time off type with this ${field} already exists`);
  }
  return error;
}

timeOffTypesRouter.get(
  '/types',
  requireAuth,
  requirePermission('read', 'timeOffType'),
  validate({ query: typeQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as TypeQuery;

    const where: Prisma.TimeOffTypeWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.OR = [
        { name: containsInsensitive(query.search) },
        { code: containsInsensitive(query.search) },
      ];
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [types, total] = await Promise.all([
      prisma.timeOffType.findMany({
        where,
        ...paginationArgs(query),
        orderBy: { name: 'asc' },
      }),
      prisma.timeOffType.count({ where }),
    ]);

    res.json(toPaginated(types.map(toRow), total, query));
  }),
);

timeOffTypesRouter.get(
  '/types/:id',
  requireAuth,
  requirePermission('read', 'timeOffType'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const type = await prisma.timeOffType.findUnique({ where: { id } });
    if (type === null) {
      throw notFound('Time off type not found');
    }

    res.json(toRow(type));
  }),
);

timeOffTypesRouter.post(
  '/types',
  requireAuth,
  requirePermission('create', 'timeOffType'),
  validate({ body: timeOffTypeSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof timeOffTypeSchema>;

    try {
      const type = await prisma.timeOffType.create({ data: toTypeData(body) });
      res.status(201).json(toRow(type));
    } catch (error) {
      throw translateTypeError(error);
    }
  }),
);

timeOffTypesRouter.patch(
  '/types/:id',
  requireAuth,
  requirePermission('update', 'timeOffType'),
  validate({ params: idParamsSchema, body: timeOffTypeSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const body = req.body as z.infer<typeof timeOffTypeSchema>;

    try {
      const type = await prisma.timeOffType.update({
        where: { id },
        data: toTypeData(body),
      });
      res.json(toRow(type));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Time off type not found');
      }
      throw translateTypeError(error);
    }
  }),
);

timeOffTypesRouter.delete(
  '/types/:id',
  requireAuth,
  requirePermission('delete', 'timeOffType'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    try {
      // Soft delete: allocations and requests reference a type with a
      // Restrict foreign key, so history must stay intact.
      await prisma.timeOffType.update({ where: { id }, data: { active: false } });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Time off type not found');
      }
      throw error;
    }
  }),
);
