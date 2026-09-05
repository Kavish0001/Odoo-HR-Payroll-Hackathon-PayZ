import { jobPositionSchema, paginationSchema } from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { conflict, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

export const jobPositionsRouter: Router = Router();

const jobPositionQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false']).optional(),
});
type JobPositionQuery = z.infer<typeof jobPositionQuerySchema>;

/** No JobPositionRow is defined in shared, so this list/detail shape is local. */
export interface JobPositionRow {
  id: string;
  title: string;
  employeeCount: number;
  contractCount: number;
  active: boolean;
}

const jobPositionWithCounts = Prisma.validator<Prisma.JobPositionDefaultArgs>()(
  {
    include: { _count: { select: { employees: true, contracts: true } } },
  },
);
type JobPositionWithCounts = Prisma.JobPositionGetPayload<
  typeof jobPositionWithCounts
>;

function toRow(position: JobPositionWithCounts): JobPositionRow {
  return {
    id: String(position.id),
    title: position.title,
    employeeCount: position._count.employees,
    contractCount: position._count.contracts,
    active: position.active,
  };
}

jobPositionsRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'jobPosition'),
  validate({ query: jobPositionQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as JobPositionQuery;

    const where: Prisma.JobPositionWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.title = containsInsensitive(query.search);
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [positions, total] = await Promise.all([
      prisma.jobPosition.findMany({
        where,
        ...jobPositionWithCounts,
        ...paginationArgs(query),
        orderBy: { title: 'asc' },
      }),
      prisma.jobPosition.count({ where }),
    ]);

    res.json(toPaginated(positions.map(toRow), total, query));
  }),
);

jobPositionsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'jobPosition'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const position = await prisma.jobPosition.findUnique({
      where: { id },
      ...jobPositionWithCounts,
    });
    if (position === null) {
      throw notFound('Job position not found');
    }

    res.json(toRow(position));
  }),
);

jobPositionsRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'jobPosition'),
  validate({ body: jobPositionSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof jobPositionSchema>;

    try {
      const position = await prisma.jobPosition.create({
        data: body,
        ...jobPositionWithCounts,
      });
      res.status(201).json(toRow(position));
    } catch (error) {
      throw translateJobPositionError(error, body.title);
    }
  }),
);

jobPositionsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'jobPosition'),
  validate({ params: idParamsSchema, body: jobPositionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as z.infer<typeof jobPositionSchema>;

    try {
      const position = await prisma.jobPosition.update({
        where: { id },
        data: body,
        ...jobPositionWithCounts,
      });
      res.json(toRow(position));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Job position not found');
      }
      throw translateJobPositionError(error, body.title);
    }
  }),
);

jobPositionsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'jobPosition'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Soft delete: contracts and employees keep pointing at this position
      // for their history.
      await prisma.jobPosition.update({
        where: { id },
        data: { active: false },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Job position not found');
      }
      throw error;
    }
  }),
);

function translateJobPositionError(error: unknown, title: string): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return conflict(`A job position titled "${title}" already exists`);
  }
  return error;
}
