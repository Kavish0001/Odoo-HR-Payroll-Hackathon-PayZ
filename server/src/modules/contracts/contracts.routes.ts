import {
  contractQuerySchema,
  contractSchema,
  type ContractQuery,
  type ContractRow,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { type z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  mustBeSelf,
  requireAuth,
  requirePermission,
  selfScope,
} from '../../middleware/auth.js';
import { conflict, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

export const contractsRouter: Router = Router();

const contractWithRelations = Prisma.validator<Prisma.ContractDefaultArgs>()({
  include: {
    employee: { select: { firstName: true, lastName: true } },
    department: { select: { name: true } },
    jobPosition: { select: { title: true } },
    workingSchedule: { select: { name: true } },
    salaryStructure: { select: { name: true } },
  },
});
type ContractWithRelations = Prisma.ContractGetPayload<
  typeof contractWithRelations
>;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRow(contract: ContractWithRelations): ContractRow {
  return {
    id: String(contract.id),
    reference: contract.reference,
    employeeId: String(contract.employeeId),
    employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`,
    departmentName: contract.department?.name ?? null,
    jobPositionTitle: contract.jobPosition?.title ?? null,
    startDate: toDateOnly(contract.startDate),
    endDate: contract.endDate === null ? null : toDateOnly(contract.endDate),
    wageMonthly: contract.wageMonthly,
    status: contract.status,
    scheduleName: contract.workingSchedule?.name ?? null,
    structureName: contract.salaryStructure?.name ?? null,
    notes: contract.notes,
  };
}

/**
 * Normalises the Zod-validated body to Prisma's shape: every nullable field
 * becomes an explicit `null` rather than `undefined`, which
 * `exactOptionalPropertyTypes` otherwise rejects when spread into `data`.
 */
function toContractData(body: z.infer<typeof contractSchema>) {
  return {
    reference: body.reference,
    employeeId: body.employeeId,
    startDate: body.startDate,
    endDate: body.endDate ?? null,
    wageMonthly: body.wageMonthly,
    departmentId: body.departmentId ?? null,
    jobPositionId: body.jobPositionId ?? null,
    workingScheduleId: body.workingScheduleId ?? null,
    salaryStructureId: body.salaryStructureId ?? null,
    status: body.status,
    notes: body.notes ?? null,
  };
}

/**
 * Rule C1: an employee may hold only one RUNNING contract for any given
 * date. Inclusive-bounds overlap test mirroring the `daterange(..., '[]')`
 * exclusion constraint in the migration, so the pre-check and the DB agree.
 */
function rangesOverlap(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date | null,
): boolean {
  const aCoversBStart = aEnd === null || aEnd.getTime() >= bStart.getTime();
  const bCoversAStart = bEnd === null || bEnd.getTime() >= aStart.getTime();
  return aCoversBStart && bCoversAStart;
}

interface RunningContractRef {
  reference: string;
}

async function findOverlappingRunning(
  employeeId: number,
  startDate: Date,
  endDate: Date | null,
  excludeContractId: number | undefined,
): Promise<RunningContractRef | null> {
  const runningContracts = await prisma.contract.findMany({
    where: {
      employeeId,
      status: 'RUNNING',
      ...(excludeContractId === undefined
        ? {}
        : { id: { not: excludeContractId } }),
    },
    select: { reference: true, startDate: true, endDate: true },
  });

  const match = runningContracts.find((existing) =>
    rangesOverlap(existing.startDate, existing.endDate, startDate, endDate),
  );
  return match ?? null;
}

/** Translates the DB-level guardrails (unique reference, exclusion constraint). */
function translateContractError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return conflict('A contract with this reference already exists');
    }

    // The overlap-prevention exclusion constraint has no dedicated Prisma
    // error code; it surfaces as a generic constraint failure naming itself
    // in the underlying database message.
    const detail =
      typeof error.meta?.['message'] === 'string'
        ? error.meta['message']
        : error.message;
    if (detail.includes('contracts_no_overlapping_running')) {
      return conflict(
        'This employee already has an overlapping RUNNING contract',
      );
    }
  }
  return error;
}

contractsRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'contract'),
  validate({ query: contractQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as ContractQuery;

    const where: Prisma.ContractWhereInput = {};

    /**
     * Search matches the employee's name, and nothing else.
     *
     * Deliberately not the contract reference: every reference is minted as
     * CON/<n>, so a single letter of "con" matched the entire table and the
     * box looked broken. Nobody searches a contract list by its reference
     * anyway -- they are looking for a person.
     *
     * Each word is required separately rather than matched as one string, so
     * "aarav mehta" and "mehta aarav" both find the same person; a single
     * `contains` on either name field would find neither.
     */
    if (query.search !== undefined && query.search.trim().length > 0) {
      where.AND = query.search
        .trim()
        .split(/\s+/)
        .map((word) => ({
          employee: {
            is: {
              OR: [
                { firstName: containsInsensitive(word) },
                { lastName: containsInsensitive(word) },
              ],
            },
          },
        }));
    }

    if (query.employeeId !== undefined) {
      where.employeeId = query.employeeId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    // R2 (defence in depth): the RBAC matrix already keeps a plain EMPLOYEE
    // out of this route, but a self-scoped caller's own id always wins over
    // whatever employeeId the client asked for.
    Object.assign(where, selfScope(req));

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        ...contractWithRelations,
        ...paginationArgs(query),
        orderBy: { startDate: 'desc' },
      }),
      prisma.contract.count({ where }),
    ]);

    res.json(toPaginated(contracts.map(toRow), total, query));
  }),
);

contractsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'contract'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const contract = await prisma.contract.findUnique({
      where: { id },
      ...contractWithRelations,
    });
    if (contract === null) {
      throw notFound('Contract not found');
    }
    mustBeSelf(req, contract.employeeId);

    res.json(toRow(contract));
  }),
);

contractsRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'contract'),
  validate({ body: contractSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof contractSchema>;

    if (body.status === 'RUNNING') {
      const overlapping = await findOverlappingRunning(
        body.employeeId,
        body.startDate,
        body.endDate ?? null,
        undefined,
      );
      if (overlapping !== null) {
        throw conflict(
          `Overlaps running contract ${overlapping.reference} for this employee`,
        );
      }
    }

    try {
      const contract = await prisma.contract.create({
        data: toContractData(body),
        ...contractWithRelations,
      });
      res.status(201).json(toRow(contract));
    } catch (error) {
      throw translateContractError(error);
    }
  }),
);

contractsRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'contract'),
  validate({ params: idParamsSchema, body: contractSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as z.infer<typeof contractSchema>;

    if (body.status === 'RUNNING') {
      const overlapping = await findOverlappingRunning(
        body.employeeId,
        body.startDate,
        body.endDate ?? null,
        id,
      );
      if (overlapping !== null) {
        throw conflict(
          `Overlaps running contract ${overlapping.reference} for this employee`,
        );
      }
    }

    try {
      const contract = await prisma.contract.update({
        where: { id },
        data: toContractData(body),
        ...contractWithRelations,
      });
      res.json(toRow(contract));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Contract not found');
      }
      throw translateContractError(error);
    }
  }),
);

contractsRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'contract'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Never hard-deleted: a payslip can reference a contract with a
      // Restrict foreign key, so payroll history must stay intact. Deleting
      // a contract cancels it instead of removing the row.
      await prisma.contract.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Contract not found');
      }
      throw error;
    }
  }),
);
