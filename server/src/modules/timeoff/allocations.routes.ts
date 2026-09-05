import {
  allocationQuerySchema,
  allocationSchema,
  type AllocationRow,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { type z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  mustBeSelf,
  refuseSelfApproval,
  requireAuth,
  requirePermission,
  selfScope,
} from '../../middleware/auth.js';
import { conflict, forbidden, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

import { deriveBalance, sumApprovedDurationByAllocation } from './balance.js';

/**
 * Mount at `/api/time-off` — this router owns the `/allocations` and
 * `/allocations/:id[...]` paths.
 */
export const allocationsRouter: Router = Router();

type AllocationQuery = z.infer<typeof allocationQuerySchema>;

const allocationWithRelations =
  Prisma.validator<Prisma.TimeOffAllocationDefaultArgs>()({
    include: {
      employee: { select: { firstName: true, lastName: true } },
      type: { select: { name: true, unit: true } },
      approver: { select: { firstName: true, lastName: true } },
    },
  });
type AllocationWithRelations = Prisma.TimeOffAllocationGetPayload<
  typeof allocationWithRelations
>;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRow(
  allocation: AllocationWithRelations,
  takenQty: number,
): AllocationRow {
  const balance = deriveBalance(
    allocation.status,
    allocation.allocatedQty,
    takenQty,
  );
  return {
    id: String(allocation.id),
    employeeId: String(allocation.employeeId),
    employeeName: `${allocation.employee.firstName} ${allocation.employee.lastName}`,
    typeId: String(allocation.typeId),
    typeName: allocation.type.name,
    unit: allocation.type.unit,
    name: allocation.name,
    allocatedQty: balance.allocatedQty,
    takenQty: balance.takenQty,
    remainingQty: balance.remainingQty,
    validFrom: toDateOnly(allocation.validFrom),
    validTo:
      allocation.validTo === null ? null : toDateOnly(allocation.validTo),
    status: allocation.status,
    approverName:
      allocation.approver === null
        ? null
        : `${allocation.approver.firstName} ${allocation.approver.lastName}`,
    description: allocation.description,
  };
}

/**
 * Normalises the Zod-validated body to Prisma's shape: every nullable field
 * becomes an explicit `null` rather than `undefined`, which
 * `exactOptionalPropertyTypes` otherwise rejects when spread into `data`.
 */
function toAllocationData(body: z.infer<typeof allocationSchema>) {
  return {
    employeeId: body.employeeId,
    typeId: body.typeId,
    name: body.name,
    allocatedQty: body.allocatedQty,
    validFrom: body.validFrom,
    validTo: body.validTo ?? null,
    description: body.description ?? null,
  };
}

allocationsRouter.get(
  '/allocations',
  requireAuth,
  requirePermission('read', 'timeOffAllocation'),
  validate({ query: allocationQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as AllocationQuery;

    const where: Prisma.TimeOffAllocationWhereInput = {};
    if (query.employeeId !== undefined) {
      where.employeeId = query.employeeId;
    }
    if (query.typeId !== undefined) {
      where.typeId = query.typeId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    // R2: an EMPLOYEE caller only ever sees their own allocations.
    Object.assign(where, selfScope(req));

    const [allocations, total] = await Promise.all([
      prisma.timeOffAllocation.findMany({
        where,
        ...allocationWithRelations,
        ...paginationArgs(query),
        orderBy: { validFrom: 'desc' },
      }),
      prisma.timeOffAllocation.count({ where }),
    ]);

    const takenMap = await sumApprovedDurationByAllocation(
      prisma,
      allocations.map((allocation) => allocation.id),
    );

    res.json(
      toPaginated(
        allocations.map((allocation) =>
          toRow(allocation, takenMap.get(allocation.id) ?? 0),
        ),
        total,
        query,
      ),
    );
  }),
);

allocationsRouter.get(
  '/allocations/:id',
  requireAuth,
  requirePermission('read', 'timeOffAllocation'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const allocation = await prisma.timeOffAllocation.findUnique({
      where: { id },
      ...allocationWithRelations,
    });
    if (allocation === null) {
      throw notFound('Allocation not found');
    }
    mustBeSelf(req, allocation.employeeId);

    const takenMap = await sumApprovedDurationByAllocation(prisma, [
      allocation.id,
    ]);
    res.json(toRow(allocation, takenMap.get(allocation.id) ?? 0));
  }),
);

allocationsRouter.post(
  '/allocations',
  requireAuth,
  requirePermission('create', 'timeOffAllocation'),
  validate({ body: allocationSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof allocationSchema>;

    const allocation = await prisma.timeOffAllocation.create({
      data: toAllocationData(body),
      ...allocationWithRelations,
    });
    res.status(201).json(toRow(allocation, 0));
  }),
);

allocationsRouter.patch(
  '/allocations/:id',
  requireAuth,
  requirePermission('update', 'timeOffAllocation'),
  validate({ params: idParamsSchema, body: allocationSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as z.infer<typeof allocationSchema>;

    try {
      const allocation = await prisma.timeOffAllocation.update({
        where: { id },
        data: toAllocationData(body),
        ...allocationWithRelations,
      });
      const takenMap = await sumApprovedDurationByAllocation(prisma, [
        allocation.id,
      ]);
      res.json(toRow(allocation, takenMap.get(allocation.id) ?? 0));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Allocation not found');
      }
      throw error;
    }
  }),
);

allocationsRouter.delete(
  '/allocations/:id',
  requireAuth,
  requirePermission('delete', 'timeOffAllocation'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    try {
      // Never hard-deleted: linked requests reference an allocation with a
      // SetNull foreign key, but cancelling (not erasing) keeps the grant's
      // history visible.
      await prisma.timeOffAllocation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      res.status(204).end();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw notFound('Allocation not found');
      }
      throw error;
    }
  }),
);

allocationsRouter.post(
  '/allocations/:id/approve',
  requireAuth,
  // Same rank as update today, but named for what it is: granting balance is
  // a decision, and the client asks for this action by name.
  requirePermission('approve', 'timeOffAllocation'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const allocation = await prisma.timeOffAllocation.findUnique({
      where: { id },
    });
    if (allocation === null) {
      throw notFound('Allocation not found');
    }
    if (allocation.status !== 'TO_APPROVE') {
      throw conflict('Only an allocation awaiting approval can be approved');
    }
    // Rule T8's principle applied to allocations too: an employee cannot
    // grant themselves leave balance under any role.
    refuseSelfApproval(req, allocation.employeeId);

    const approverId = getUser(req).employeeId;
    if (approverId === null) {
      throw forbidden('Only a user linked to an employee record can approve');
    }

    const updated = await prisma.timeOffAllocation.update({
      where: { id },
      data: { status: 'APPROVED', approverId },
      ...allocationWithRelations,
    });
    const takenMap = await sumApprovedDurationByAllocation(prisma, [
      updated.id,
    ]);
    res.json(toRow(updated, takenMap.get(updated.id) ?? 0));
  }),
);

allocationsRouter.post(
  '/allocations/:id/refuse',
  requireAuth,
  // Same rank as update today, but named for what it is: granting balance is
  // a decision, and the client asks for this action by name.
  requirePermission('approve', 'timeOffAllocation'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const allocation = await prisma.timeOffAllocation.findUnique({
      where: { id },
    });
    if (allocation === null) {
      throw notFound('Allocation not found');
    }
    if (allocation.status !== 'TO_APPROVE') {
      throw conflict('Only an allocation awaiting approval can be refused');
    }

    const approverId = getUser(req).employeeId;
    if (approverId === null) {
      throw forbidden('Only a user linked to an employee record can refuse');
    }

    const updated = await prisma.timeOffAllocation.update({
      where: { id },
      data: { status: 'REFUSED', approverId },
      ...allocationWithRelations,
    });
    res.json(toRow(updated, 0));
  }),
);
