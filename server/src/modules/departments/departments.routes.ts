import {
  departmentSchema,
  paginationSchema,
  type DepartmentRow,
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

export const departmentsRouter: Router = Router();

const departmentQuerySchema = paginationSchema.extend({
  active: z.enum(['true', 'false']).optional(),
});
type DepartmentQuery = z.infer<typeof departmentQuerySchema>;

/** DepartmentRow plus the raw ids a form needs to pre-fill, not just labels. */
interface DepartmentDetail extends DepartmentRow {
  managerId: string | null;
}

const departmentWithRelations =
  Prisma.validator<Prisma.DepartmentDefaultArgs>()({
    include: {
      manager: { select: { firstName: true, lastName: true } },
      _count: { select: { employees: true } },
    },
  });
type DepartmentWithRelations = Prisma.DepartmentGetPayload<
  typeof departmentWithRelations
>;

function toDetail(department: DepartmentWithRelations): DepartmentDetail {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    managerId: department.managerId,
    managerName:
      department.manager === null
        ? null
        : `${department.manager.firstName} ${department.manager.lastName}`,
    employeeCount: department._count.employees,
    active: department.active,
  };
}

departmentsRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'department'),
  validate({ query: departmentQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as DepartmentQuery;

    const where: Prisma.DepartmentWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.OR = [
        { name: containsInsensitive(query.search) },
        { code: containsInsensitive(query.search) },
      ];
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        ...departmentWithRelations,
        ...paginationArgs(query),
        orderBy: { name: 'asc' },
      }),
      prisma.department.count({ where }),
    ]);

    res.json(toPaginated(departments.map(toDetail), total, query));
  }),
);

departmentsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'department'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const department = await prisma.department.findUnique({
      where: { id },
      ...departmentWithRelations,
    });
    if (department === null) {
      throw notFound('Department not found');
    }

    res.json(toDetail(department));
  }),
);

departmentsRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'department'),
  validate({ body: departmentSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof departmentSchema>;
    const companyId = await getDefaultCompanyId();

    try {
      const department = await prisma.department.create({
        data: {
          name: body.name,
          code: body.code ?? null,
          managerId: body.managerId ?? null,
          active: body.active,
          companyId,
        },
        ...departmentWithRelations,
      });
      res.status(201).json(toDetail(department));
    } catch (error) {
      throw translateDepartmentError(error, body.name);
    }
  }),
);

departmentsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'department'),
  validate({ params: idParamsSchema, body: departmentSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const body = req.body as z.infer<typeof departmentSchema>;

    try {
      const department = await prisma.department.update({
        where: { id },
        data: {
          name: body.name,
          code: body.code ?? null,
          managerId: body.managerId ?? null,
          active: body.active,
        },
        ...departmentWithRelations,
      });
      res.json(toDetail(department));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Department not found');
      }
      throw translateDepartmentError(error, body.name);
    }
  }),
);

departmentsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'department'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    try {
      // Soft delete: a department may be referenced by historical contracts
      // and payslips, which must never be orphaned.
      await prisma.department.update({
        where: { id },
        data: { active: false },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Department not found');
      }
      throw error;
    }
  }),
);

function translateDepartmentError(error: unknown, name: string): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return conflict(`A department named "${name}" already exists`);
  }
  return error;
}
