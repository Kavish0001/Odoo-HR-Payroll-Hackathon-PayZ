import {
  can,
  employeeQuerySchema,
  employeeSchema,
  employeeSelfSchema,
  type EmployeeDetail,
  type EmployeeQuery,
  type EmployeeRow,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { type z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  mustBeSelf,
  requireAuth,
  requirePermission,
  selfScope,
} from '../../middleware/auth.js';
import { conflict, forbidden, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { getDefaultCompanyId } from '../common/company.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

export const employeesRouter: Router = Router();

const employeeWithRelations = Prisma.validator<Prisma.EmployeeDefaultArgs>()({
  include: {
    department: { select: { name: true } },
    jobPosition: { select: { title: true } },
    manager: { select: { firstName: true, lastName: true } },
    workingSchedule: { select: { name: true } },
  },
});
type EmployeeWithRelations = Prisma.EmployeeGetPayload<
  typeof employeeWithRelations
>;

const employeeWithDetail = Prisma.validator<Prisma.EmployeeDefaultArgs>()({
  include: {
    ...employeeWithRelations.include,
    _count: {
      select: {
        contracts: true,
        attendances: true,
        timeOffRequests: true,
        allocations: true,
      },
    },
  },
});
type EmployeeWithDetail = Prisma.EmployeeGetPayload<typeof employeeWithDetail>;

function initials(firstName: string, lastName: string): string {
  const first = firstName.charAt(0);
  const last = lastName.charAt(0);
  return `${first}${last}`.toUpperCase();
}

function toRow(employee: EmployeeWithRelations): EmployeeRow {
  return {
    id: String(employee.id),
    code: employee.code,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: `${employee.firstName} ${employee.lastName}`,
    initials: initials(employee.firstName, employee.lastName),
    workEmail: employee.workEmail,
    phone: employee.phone,
    departmentName: employee.department?.name ?? null,
    jobPositionTitle: employee.jobPosition?.title ?? null,
    managerName:
      employee.manager === null
        ? null
        : `${employee.manager.firstName} ${employee.manager.lastName}`,
    scheduleName: employee.workingSchedule?.name ?? null,
    employeeType: employee.employeeType,
    workLocation: employee.workLocation,
    active: employee.active,
    // The MISSING_BANK_ACCOUNT warning fires on absence of a bank account.
    missingBankDetails: employee.bankAccount === null,
  };
}

function toDetail(employee: EmployeeWithDetail): EmployeeDetail {
  return {
    ...toRow(employee),
    personalEmail: employee.personalEmail,
    bankAccount: employee.bankAccount,
    bankName: employee.bankName,
    bankIfsc: employee.bankIfsc,
    joinDate:
      employee.joinDate === null ? null : employee.joinDate.toISOString(),
    departmentId:
      employee.departmentId === null ? null : String(employee.departmentId),
    jobPositionId:
      employee.jobPositionId === null ? null : String(employee.jobPositionId),
    managerId: employee.managerId === null ? null : String(employee.managerId),
    workingScheduleId:
      employee.workingScheduleId === null
        ? null
        : String(employee.workingScheduleId),
    counts: {
      contracts: employee._count.contracts,
      attendance: employee._count.attendances,
      timeOff: employee._count.timeOffRequests,
      allocations: employee._count.allocations,
    },
  };
}

/**
 * Normalises the Zod-validated body to Prisma's shape: every nullable field
 * becomes an explicit `null` rather than `undefined`, which
 * `exactOptionalPropertyTypes` otherwise rejects when spread into `data`.
 */
function toEmployeeData(body: z.infer<typeof employeeSchema>) {
  return {
    code: body.code,
    firstName: body.firstName,
    lastName: body.lastName,
    workEmail: body.workEmail,
    personalEmail: body.personalEmail ?? null,
    phone: body.phone ?? null,
    departmentId: body.departmentId ?? null,
    jobPositionId: body.jobPositionId ?? null,
    managerId: body.managerId ?? null,
    workingScheduleId: body.workingScheduleId ?? null,
    employeeType: body.employeeType,
    workLocation: body.workLocation ?? null,
    bankAccount: body.bankAccount ?? null,
    bankName: body.bankName ?? null,
    bankIfsc: body.bankIfsc ?? null,
    joinDate: body.joinDate ?? null,
    active: body.active,
  };
}

/**
 * The subset of columns an employee may change on their own record.
 *
 * Deliberately built from `employeeSelfSchema` rather than from the request:
 * whatever a self-editing caller sends, only these five columns can reach the
 * database. A tampered payload carrying `active: true` or another
 * `departmentId` does not fail -- those keys simply do not exist here.
 */
function toEmployeeSelfData(body: z.infer<typeof employeeSelfSchema>) {
  return {
    personalEmail: body.personalEmail ?? null,
    phone: body.phone ?? null,
    bankAccount: body.bankAccount ?? null,
    bankName: body.bankName ?? null,
    bankIfsc: body.bankIfsc ?? null,
  };
}

/** Duplicate `code` or `workEmail` on create/update, named for the caller. */
function translateEmployeeError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.['target'];
    const field = Array.isArray(target)
      ? target.join(', ')
      : typeof target === 'string'
        ? target
        : 'field';
    return conflict(`An employee with this ${field} already exists`);
  }
  return error;
}

employeesRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'employee'),
  validate({ query: employeeQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as EmployeeQuery;

    const where: Prisma.EmployeeWhereInput = {};
    if (query.search !== undefined && query.search.length > 0) {
      where.OR = [
        { firstName: containsInsensitive(query.search) },
        { lastName: containsInsensitive(query.search) },
        { code: containsInsensitive(query.search) },
        { workEmail: containsInsensitive(query.search) },
      ];
    }
    if (query.departmentId !== undefined) {
      where.departmentId = query.departmentId;
    }
    if (query.employeeType !== undefined) {
      where.employeeType = query.employeeType;
    }
    if (query.active !== undefined) {
      where.active = query.active === 'true';
    }

    // R2: an EMPLOYEE caller only ever sees their own record. Applied last so
    // it always wins over whatever the client passed in `where`.
    Object.assign(where, selfScope(req, 'id'));

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        ...employeeWithRelations,
        ...paginationArgs(query),
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.employee.count({ where }),
    ]);

    res.json(toPaginated(employees.map(toRow), total, query));
  }),
);

employeesRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'employee'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    mustBeSelf(req, id);

    const employee = await prisma.employee.findUnique({
      where: { id },
      ...employeeWithDetail,
    });
    if (employee === null) {
      throw notFound('Employee not found');
    }

    res.json(toDetail(employee));
  }),
);

employeesRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'employee'),
  validate({ body: employeeSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof employeeSchema>;
    const companyId = await getDefaultCompanyId();

    try {
      const employee = await prisma.employee.create({
        data: { ...toEmployeeData(body), companyId },
        ...employeeWithDetail,
      });
      res.status(201).json(toDetail(employee));
    } catch (error) {
      throw translateEmployeeError(error);
    }
  }),
);

/**
 * Two callers reach this route, and they are not editing the same record.
 *
 * HR sends the whole employee and holds `update`. Everyone else holds only
 * `updateSelf`, may address only their own id, and has their payload parsed
 * by the narrower schema -- so the body is validated against what that caller
 * is actually allowed to change, rather than being validated loosely and then
 * trimmed. The guard is the lower of the two permissions because the stricter
 * one is checked here, where the target id is known.
 */
employeesRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('updateSelf', 'employee'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const user = getUser(req);
    const isHr = can(user.roles, 'update', 'employee');

    if (!isHr && user.employeeId !== id) {
      throw forbidden('You may only update your own details');
    }

    // Parsed here rather than in `validate` because which schema applies
    // depends on the caller. A ZodError from either reaches the same central
    // handler and comes back as field errors.
    const data = isHr
      ? toEmployeeData(employeeSchema.parse(req.body))
      : toEmployeeSelfData(employeeSelfSchema.parse(req.body));

    try {
      const employee = await prisma.employee.update({
        where: { id },
        data,
        ...employeeWithDetail,
      });
      res.json(toDetail(employee));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Employee not found');
      }
      throw translateEmployeeError(error);
    }
  }),
);

employeesRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'employee'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Soft delete: attendance, time off and payslip history must never be
      // orphaned by removing the employee they belong to.
      await prisma.employee.update({ where: { id }, data: { active: false } });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Employee not found');
      }
      throw error;
    }
  }),
);
