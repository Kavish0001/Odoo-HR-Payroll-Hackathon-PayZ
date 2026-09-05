import {
  ROLES,
  createUserSchema,
  paginationSchema,
  updateUserSchema,
  type Role,
  type UserStatus,
} from '@payz/shared';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  requireAuth,
  requirePermission,
} from '../../middleware/auth.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { hashPassword } from '../auth/session.js';
import { asyncRoute } from '../common/async-route.js';
import {
  containsInsensitive,
  paginationArgs,
  toPaginated,
} from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

export const usersRouter: Router = Router();

/** What the admin list shows. The password hash never leaves the server. */
export interface UserRow {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  employeeId: string | null;
  employeeName: string | null;
  departmentName: string | null;
  lastLoginAt: string | null;
}

const userSelect = {
  id: true,
  email: true,
  status: true,
  roles: true,
  employeeId: true,
  lastLoginAt: true,
  employee: {
    select: {
      firstName: true,
      lastName: true,
      department: { select: { name: true } },
    },
  },
} as const;

interface UserRecord {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  employeeId: string | null;
  lastLoginAt: Date | null;
  employee: {
    firstName: string;
    lastName: string;
    department: { name: string } | null;
  } | null;
}

function toRow(user: UserRecord): UserRow {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    roles: user.roles,
    employeeId: user.employeeId,
    employeeName:
      user.employee === null
        ? null
        : `${user.employee.firstName} ${user.employee.lastName}`,
    departmentName: user.employee?.department?.name ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

/**
 * Rule R5: a user may not change their own roles or status.
 *
 * Enforced in the service rather than the controller, so it holds for every
 * caller. Without it, the only thing stopping an admin demotion mistake, or a
 * compromised session escalating itself, would be the UI hiding a control.
 */
function refuseSelfElevation(
  actingUserId: string,
  targetUserId: string,
  body: { roles?: unknown; status?: unknown },
): void {
  if (actingUserId !== targetUserId) {
    return;
  }
  if (body.roles !== undefined || body.status !== undefined) {
    throw forbidden(
      'You cannot change your own roles or account status. Ask another administrator.',
    );
  }
}

const userQuerySchema = paginationSchema.extend({
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

usersRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'user'),
  validate({ query: userQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof userQuerySchema>;
    const { skip, take } = paginationArgs(query);

    const where = {
      ...(query.search !== undefined && query.search.length > 0
        ? {
            OR: [
              { email: containsInsensitive(query.search) },
              {
                employee: {
                  is: {
                    OR: [
                      { firstName: containsInsensitive(query.search) },
                      { lastName: containsInsensitive(query.search) },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.role !== undefined ? { roles: { has: query.role } } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { email: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    res.json(toPaginated(rows.map(toRow), total, query));
  }),
);

usersRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'user'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (user === null) {
      throw notFound('User not found');
    }
    res.json(toRow(user));
  }),
);

usersRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'user'),
  validate({ body: createUserSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as z.infer<typeof createUserSchema>;

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing !== null) {
      throw conflict('An account with that email already exists');
    }

    if (body.employeeId != null) {
      const employee = await prisma.employee.findUnique({
        where: { id: body.employeeId },
        select: { id: true, user: { select: { id: true } } },
      });
      if (employee === null) {
        throw badRequest('That employee does not exist');
      }
      // Employee.userId is unique, so a second account would fail at the
      // database anyway; saying so plainly is more useful than a constraint.
      if (employee.user !== null) {
        throw conflict('That employee already has an account');
      }
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        roles: body.roles,
        status: body.status,
        employeeId: body.employeeId ?? null,
      },
      select: userSelect,
    });

    res.status(201).json(toRow(user));
  }),
);

usersRouter.patch(
  '/:id',
  requireAuth,
  requirePermission('update', 'user'),
  validate({ params: idParamsSchema, body: updateUserSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const body = req.body as z.infer<typeof updateUserSchema>;

    refuseSelfElevation(getUser(req).id, id, body);

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, roles: true },
    });
    if (target === null) {
      throw notFound('User not found');
    }

    // Losing the last administrator locks everyone out of user management.
    if (body.roles !== undefined && target.roles.includes('ADMIN')) {
      const stillAdmin = body.roles.includes('ADMIN');
      if (!stillAdmin) {
        const admins = await prisma.user.count({
          where: { roles: { has: 'ADMIN' }, status: 'ACTIVE' },
        });
        if (admins <= 1) {
          throw conflict(
            'This is the only active administrator. Promote someone else first.',
          );
        }
      }
    }

    const changesAccess = body.roles !== undefined || body.status !== undefined;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.roles !== undefined ? { roles: body.roles } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.employeeId !== undefined
          ? { employeeId: body.employeeId ?? null }
          : {}),
        ...(body.password !== undefined
          ? { passwordHash: await hashPassword(body.password) }
          : {}),
        // Changing roles, status or the password invalidates sessions already
        // issued, rather than leaving them valid for the rest of the window
        // (guardrail 10.2).
        ...(changesAccess || body.password !== undefined
          ? { tokenVersion: { increment: 1 } }
          : {}),
      },
      select: userSelect,
    });

    res.json(toRow(user));
  }),
);

usersRouter.delete(
  '/:id',
  requireAuth,
  requirePermission('delete', 'user'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    if (getUser(req).id === id) {
      throw forbidden('You cannot deactivate your own account');
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { roles: true },
    });
    if (target === null) {
      throw notFound('User not found');
    }

    if (target.roles.includes('ADMIN')) {
      const admins = await prisma.user.count({
        where: { roles: { has: 'ADMIN' }, status: 'ACTIVE' },
      });
      if (admins <= 1) {
        throw conflict(
          'This is the only active administrator and cannot be deactivated.',
        );
      }
    }

    // Deactivated, never deleted: audit rows and payruns reference the user.
    const user = await prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE', tokenVersion: { increment: 1 } },
      select: userSelect,
    });

    res.json(toRow(user));
  }),
);
