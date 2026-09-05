import {
  changePasswordSchema,
  loginSchema,
  type SessionUser,
} from '@payz/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { isTest } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { getUser, requireAuth } from '../../middleware/auth.js';
import { badRequest, unauthorized } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';

import {
  clearSessionCookie,
  hashPassword,
  setSessionCookie,
  signSession,
  verifyPassword,
  verifyPasswordConstantTime,
} from './session.js';

export const authRouter: Router = Router();

/**
 * Five attempts per fifteen minutes, keyed on IP and email together so one
 * attacker cannot lock out a real user by hammering their address
 * (guardrail 10.1).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req) => {
    const body = req.body as { email?: string };
    return `${req.ip ?? 'unknown'}:${body.email ?? ''}`;
  },
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many sign-in attempts. Try again in a few minutes.',
  },
});

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  (req, res, next) => {
    void (async () => {
      try {
        const { email, password } = req.body as {
          email: string;
          password: string;
        };

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            roles: true,
            status: true,
            tokenVersion: true,
            employeeId: true,
          },
        });

        // Always run the comparison, even with no user, so a wrong email and
        // a wrong password cannot be distinguished by response time.
        const valid = await verifyPasswordConstantTime(
          password,
          user?.passwordHash ?? null,
        );

        // One generic message for every failure: no account enumeration.
        if (!valid || user?.status !== 'ACTIVE') {
          next(unauthorized('Incorrect email or password'));
          return;
        }

        const token = signSession({
          sub: user.id,
          email: user.email,
          roles: user.roles,
          employeeId: user.employeeId,
          tokenVersion: user.tokenVersion,
        });

        setSessionCookie(res, token);

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        res.json({ user: await loadSessionUser(user.id) });
      } catch (error) {
        next(error);
      }
    })();
  },
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res, next) => {
  void (async () => {
    try {
      res.json({ user: await loadSessionUser(getUser(req).id) });
    } catch (error) {
      next(error);
    }
  })();
});

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  (req, res, next) => {
    void (async () => {
      try {
        const { currentPassword, newPassword } = req.body as {
          currentPassword: string;
          newPassword: string;
        };
        const sessionUser = getUser(req);

        const user = await prisma.user.findUniqueOrThrow({
          where: { id: sessionUser.id },
          select: { passwordHash: true, tokenVersion: true },
        });

        if (!(await verifyPassword(currentPassword, user.passwordHash))) {
          next(badRequest('Current password is incorrect'));
          return;
        }

        await prisma.user.update({
          where: { id: sessionUser.id },
          data: {
            passwordHash: await hashPassword(newPassword),
            // Sign every other session out.
            tokenVersion: { increment: 1 },
          },
        });

        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  },
);

async function loadSessionUser(userId: number): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      roles: true,
      employeeId: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
        },
      },
    },
  });

  // The wire boundary: ids are integers in Postgres and strings in JSON, so
  // the browser never has to know which.
  return {
    id: String(user.id),
    email: user.email,
    roles: user.roles,
    employeeId: user.employeeId === null ? null : String(user.employeeId),
    employeeName:
      user.employee === null
        ? null
        : `${user.employee.firstName} ${user.employee.lastName}`,
    departmentName: user.employee?.department?.name ?? null,
  };
}
