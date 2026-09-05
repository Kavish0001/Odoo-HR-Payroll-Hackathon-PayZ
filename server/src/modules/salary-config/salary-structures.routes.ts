import {
  paginationSchema,
  salaryStructureSchema,
  type SalaryStructureInput,
  type SalaryStructureRow,
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

import { employeeCountsByStructure, toSalaryRuleRow } from './helpers.js';

export const salaryStructuresRouter: Router = Router();

const structureQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false']).optional(),
});
type StructureQuery = z.infer<typeof structureQuerySchema>;

const structureWithCount =
  Prisma.validator<Prisma.SalaryStructureDefaultArgs>()({
    include: { _count: { select: { rules: true } } },
  });
type StructureWithCount = Prisma.SalaryStructureGetPayload<
  typeof structureWithCount
>;

const structureWithRules =
  Prisma.validator<Prisma.SalaryStructureDefaultArgs>()({
    include: {
      rules: { orderBy: { sequence: 'asc' } },
      _count: { select: { rules: true } },
    },
  });
type StructureWithRules = Prisma.SalaryStructureGetPayload<
  typeof structureWithRules
>;

/** The structure row plus its rules in sequence order, for the detail screen. */
interface SalaryStructureDetail extends SalaryStructureRow {
  rules: ReturnType<typeof toSalaryRuleRow>[];
}

function toRow(
  structure: StructureWithCount,
  employeeCount: number,
): SalaryStructureRow {
  return {
    id: String(structure.id),
    name: structure.name,
    code: structure.code,
    active: structure.active,
    ruleCount: structure._count.rules,
    employeeCount,
  };
}

/** Duplicate `code` or `name` on create/update, named for the caller (rule P1-adjacent). */
function translateStructureError(
  error: unknown,
  body: { name: string; code: string },
): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.['target'];
    const fields = Array.isArray(target)
      ? target.map(String)
      : typeof target === 'string'
        ? [target]
        : [];

    if (fields.includes('code')) {
      return conflict(`A structure with code "${body.code}" already exists`);
    }
    if (fields.some((field) => field.includes('name'))) {
      return conflict(`A structure named "${body.name}" already exists`);
    }
    return conflict('This structure conflicts with an existing one');
  }
  return error;
}

salaryStructuresRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'salaryStructure'),
  validate({ query: structureQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as StructureQuery;

    const where: Prisma.SalaryStructureWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.OR = [
        { name: containsInsensitive(query.search) },
        { code: containsInsensitive(query.search) },
      ];
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [structures, total] = await Promise.all([
      prisma.salaryStructure.findMany({
        where,
        ...structureWithCount,
        ...paginationArgs(query),
        orderBy: { name: 'asc' },
      }),
      prisma.salaryStructure.count({ where }),
    ]);

    const counts = await employeeCountsByStructure(
      structures.map((structure) => structure.id),
    );

    res.json(
      toPaginated(
        structures.map((structure) =>
          toRow(structure, counts.get(structure.id) ?? 0),
        ),
        total,
        query,
      ),
    );
  }),
);

salaryStructuresRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'salaryStructure'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const structure: StructureWithRules | null =
      await prisma.salaryStructure.findUnique({
        where: { id },
        ...structureWithRules,
      });
    if (structure === null) {
      throw notFound('Salary structure not found');
    }

    const counts = await employeeCountsByStructure([id]);

    const detail: SalaryStructureDetail = {
      ...toRow(structure, counts.get(id) ?? 0),
      rules: structure.rules.map((rule) =>
        toSalaryRuleRow(rule, structure.name),
      ),
    };

    res.json(detail);
  }),
);

salaryStructuresRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'salaryStructure'),
  validate({ body: salaryStructureSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as SalaryStructureInput;
    const companyId = await getDefaultCompanyId();

    try {
      const structure = await prisma.salaryStructure.create({
        data: {
          name: body.name,
          code: body.code,
          active: body.active,
          companyId,
        },
        ...structureWithCount,
      });
      res.status(201).json(toRow(structure, 0));
    } catch (error) {
      throw translateStructureError(error, body);
    }
  }),
);

salaryStructuresRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'salaryStructure'),
  validate({ params: idParamsSchema, body: salaryStructureSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as SalaryStructureInput;

    try {
      const structure = await prisma.salaryStructure.update({
        where: { id },
        data: {
          name: body.name,
          code: body.code,
          active: body.active,
        },
        ...structureWithCount,
      });
      const counts = await employeeCountsByStructure([id]);
      res.json(toRow(structure, counts.get(id) ?? 0));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Salary structure not found');
      }
      throw translateStructureError(error, body);
    }
  }),
);

salaryStructuresRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'salaryStructure'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Soft delete: contracts, payruns and payslips may reference this
      // structure historically and must never be orphaned (guardrail 10.4).
      await prisma.salaryStructure.update({
        where: { id },
        data: { active: false },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Salary structure not found');
      }
      throw error;
    }
  }),
);
