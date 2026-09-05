import {
  can,
  idSchema,
  isSelfScoped,
  timeOffRequestQuerySchema,
  timeOffRequestSchema,
  type LeaveBalanceRow,
  type TimeOffRequestRow,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  mustBeSelf,
  refuseSelfApproval,
  requireAuth,
  requirePermission,
  selfScope,
} from '../../middleware/auth.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';
import { paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

import { approveTimeOffRequest } from './approve-request.js';
import { remainingFrom, sumApprovedDurationByAllocation } from './balance.js';
import { countWorkingDays, fetchEmployeeScheduleLines } from './duration.js';

/**
 * Mount at `/api/time-off` — this router owns the `/requests`,
 * `/requests/:id[...]` and `/balances` paths.
 */
export const timeOffRequestsRouter: Router = Router();

type RequestQuery = z.infer<typeof timeOffRequestQuerySchema>;

const requestWithRelations =
  Prisma.validator<Prisma.TimeOffRequestDefaultArgs>()({
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
      type: { select: { name: true, unit: true } },
      approver: { select: { firstName: true, lastName: true } },
      allocation: { select: { name: true } },
    },
  });
type RequestWithRelations = Prisma.TimeOffRequestGetPayload<
  typeof requestWithRelations
>;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toRow(request: RequestWithRelations): TimeOffRequestRow {
  return {
    id: String(request.id),
    employeeId: String(request.employeeId),
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    departmentName: request.employee.department?.name ?? null,
    typeId: String(request.typeId),
    typeName: request.type.name,
    unit: request.type.unit,
    startDate: toDateOnly(request.startDate),
    endDate: toDateOnly(request.endDate),
    duration: request.duration,
    status: request.status,
    approverName:
      request.approver === null
        ? null
        : `${request.approver.firstName} ${request.approver.lastName}`,
    reason: request.reason,
    allocationId:
      request.allocationId === null ? null : String(request.allocationId),
    allocationName: request.allocation?.name ?? null,
  };
}

async function loadRequestRow(id: number): Promise<TimeOffRequestRow> {
  const request = await prisma.timeOffRequest.findUnique({
    where: { id },
    ...requestWithRelations,
  });
  if (request === null) {
    throw notFound('Time off request not found');
  }
  return toRow(request);
}

/** Rule T6: working days from the employee's schedule, not calendar days. */
async function computeDuration(
  employeeId: number,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const lines = await fetchEmployeeScheduleLines(prisma, employeeId);
  const duration = countWorkingDays(startDate, endDate, lines);
  if (duration <= 0) {
    throw badRequest(
      'The selected dates contain no working day for this employee',
    );
  }
  return duration;
}

timeOffRequestsRouter.get(
  '/requests',
  requireAuth,
  requirePermission('read', 'timeOffRequest'),
  validate({ query: timeOffRequestQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as RequestQuery;

    const where: Prisma.TimeOffRequestWhereInput = {};
    if (query.employeeId !== undefined) {
      where.employeeId = query.employeeId;
    }
    if (query.typeId !== undefined) {
      where.typeId = query.typeId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    // R2: an EMPLOYEE caller only ever sees their own requests.
    Object.assign(where, selfScope(req));

    const [requests, total] = await Promise.all([
      prisma.timeOffRequest.findMany({
        where,
        ...requestWithRelations,
        ...paginationArgs(query),
        orderBy: { startDate: 'desc' },
      }),
      prisma.timeOffRequest.count({ where }),
    ]);

    res.json(toPaginated(requests.map(toRow), total, query));
  }),
);

timeOffRequestsRouter.get(
  '/balances',
  requireAuth,
  requirePermission('read', 'timeOffRequest'),
  validate({ query: z.object({ employeeId: idSchema.optional() }) }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as { employeeId?: number };
    const user = getUser(req);

    let employeeId: number;
    if (isSelfScoped(user.roles)) {
      if (user.employeeId === null) {
        throw forbidden('This account is not linked to an employee record');
      }
      // R2: a self-scoped caller can only ever ask for their own balances.
      employeeId = user.employeeId;
    } else {
      if (query.employeeId === undefined) {
        throw badRequest('employeeId is required');
      }
      employeeId = query.employeeId;
    }

    const types = await prisma.timeOffType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    const rows: LeaveBalanceRow[] = [];
    for (const type of types) {
      const pendingAgg = await prisma.timeOffRequest.aggregate({
        where: { employeeId, typeId: type.id, status: 'TO_APPROVE' },
        _sum: { duration: true },
      });
      const pending = pendingAgg._sum.duration ?? 0;

      if (!type.requiresAllocation) {
        // Rule T4: no allocation, no balance to derive — remaining is
        // meaningless and the client shows "N/A" based on requiresAllocation.
        const takenAgg = await prisma.timeOffRequest.aggregate({
          where: { employeeId, typeId: type.id, status: 'APPROVED' },
          _sum: { duration: true },
        });
        rows.push({
          typeId: String(type.id),
          typeName: type.name,
          unit: type.unit,
          requiresAllocation: false,
          allocated: 0,
          taken: takenAgg._sum.duration ?? 0,
          remaining: 0,
          pending,
        });
        continue;
      }

      const allocations = await prisma.timeOffAllocation.findMany({
        where: { employeeId, typeId: type.id, status: 'APPROVED' },
        select: { id: true, allocatedQty: true },
      });
      const takenMap = await sumApprovedDurationByAllocation(
        prisma,
        allocations.map((allocation) => allocation.id),
      );
      const allocated = allocations.reduce(
        (sum, allocation) => sum + allocation.allocatedQty,
        0,
      );
      const taken = allocations.reduce(
        (sum, allocation) => sum + (takenMap.get(allocation.id) ?? 0),
        0,
      );

      rows.push({
        typeId: String(type.id),
        typeName: type.name,
        unit: type.unit,
        requiresAllocation: true,
        allocated,
        taken,
        remaining: remainingFrom(allocated, taken),
        pending,
      });
    }

    res.json(rows);
  }),
);

timeOffRequestsRouter.get(
  '/requests/:id',
  requireAuth,
  requirePermission('read', 'timeOffRequest'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
      ...requestWithRelations,
    });
    if (request === null) {
      throw notFound('Time off request not found');
    }
    mustBeSelf(req, request.employeeId);

    res.json(toRow(request));
  }),
);

timeOffRequestsRouter.post(
  '/requests',
  requireAuth,
  requirePermission('create', 'timeOffRequest'),
  validate({ body: timeOffRequestSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof timeOffRequestSchema>;
    mustBeSelf(req, body.employeeId);

    const duration = await computeDuration(
      body.employeeId,
      body.startDate,
      body.endDate,
    );

    const created = await prisma.timeOffRequest.create({
      data: {
        employeeId: body.employeeId,
        typeId: body.typeId,
        startDate: body.startDate,
        endDate: body.endDate,
        duration,
        reason: body.reason ?? null,
      },
    });

    res.status(201).json(await loadRequestRow(created.id));
  }),
);

timeOffRequestsRouter.patch(
  '/requests/:id',
  requireAuth,
  requirePermission('update', 'timeOffRequest'),
  validate({ params: idParamsSchema, body: timeOffRequestSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const body = req.body as z.infer<typeof timeOffRequestSchema>;
    mustBeSelf(req, body.employeeId);

    const existing = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Time off request not found');
    }
    if (existing.status !== 'TO_APPROVE') {
      throw conflict('Only a request awaiting approval can be edited');
    }

    const duration = await computeDuration(
      body.employeeId,
      body.startDate,
      body.endDate,
    );

    await prisma.timeOffRequest.update({
      where: { id },
      data: {
        employeeId: body.employeeId,
        typeId: body.typeId,
        startDate: body.startDate,
        endDate: body.endDate,
        duration,
        reason: body.reason ?? null,
      },
    });

    res.json(await loadRequestRow(id));
  }),
);

/**
 * Cancels a request -- this is a withdrawal, not a deletion: the row survives
 * as CANCELLED so the history stays queryable.
 *
 * Guarded at the level an employee holds, because withdrawing your own
 * request is the other half of being allowed to file one. Cancelling somebody
 * else's still needs 'delete', which is HR_MANAGER and above.
 */
timeOffRequestsRouter.delete(
  '/requests/:id',
  requireAuth,
  requirePermission('update', 'timeOffRequest'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const existing = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Time off request not found');
    }
    if (!can(getUser(req).roles, 'delete', 'timeOffRequest')) {
      mustBeSelf(req, existing.employeeId);
    }
    if (existing.status === 'REFUSED' || existing.status === 'CANCELLED') {
      throw conflict('This request has already been finalised');
    }

    // Rule T5: cancelling an APPROVED request returns its days by clearing
    // the allocation link — remaining is derived, so it updates itself the
    // moment this request stops counting as APPROVED.
    await prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'CANCELLED', allocationId: null },
    });
    res.status(204).end();
  }),
);

timeOffRequestsRouter.post(
  '/requests/:id/approve',
  requireAuth,
  // 'approve', not 'update': the matrix grants EMPLOYEE update on a time off
  // request so they can edit their own while it is pending. Guarding this
  // with update let any employee approve a colleague's leave -- refusing
  // self-approval below is not enough, because the request being decided is
  // somebody else's (rule T8).
  requirePermission('approve', 'timeOffRequest'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const existing = await prisma.timeOffRequest.findUnique({
      where: { id },
      select: { employeeId: true },
    });
    if (existing === null) {
      throw notFound('Time off request not found');
    }
    // Rule T8: an employee can never approve their own request.
    refuseSelfApproval(req, existing.employeeId);

    const approverId = getUser(req).employeeId;
    if (approverId === null) {
      throw forbidden('Only a user linked to an employee record can approve');
    }

    await approveTimeOffRequest(prisma, id, approverId);
    res.json(await loadRequestRow(id));
  }),
);

timeOffRequestsRouter.post(
  '/requests/:id/refuse',
  requireAuth,
  requirePermission('approve', 'timeOffRequest'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const existing = await prisma.timeOffRequest.findUnique({ where: { id } });
    if (existing === null) {
      throw notFound('Time off request not found');
    }
    if (existing.status === 'REFUSED' || existing.status === 'CANCELLED') {
      throw conflict('This request has already been finalised');
    }
    // Rule T8 cuts both ways: deciding your own request is not allowed, and
    // refusing is a decision. An employee withdraws their own request by
    // cancelling it (DELETE), which is a different act with a different
    // status.
    refuseSelfApproval(req, existing.employeeId);

    const approverId = getUser(req).employeeId;
    if (approverId === null) {
      throw forbidden('Only a user linked to an employee record can refuse');
    }

    // Rule T5: refusing an APPROVED request returns its days.
    await prisma.timeOffRequest.update({
      where: { id },
      data: { status: 'REFUSED', approverId, allocationId: null },
    });
    res.json(await loadRequestRow(id));
  }),
);
