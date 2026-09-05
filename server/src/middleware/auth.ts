import {
  atLeast,
  can,
  isSelfScoped,
  type Action,
  type Resource,
  type Role,
} from '@payz/shared';
import {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';

import { prisma } from '../config/prisma.js';
import { SESSION_COOKIE, verifySession } from '../modules/auth/session.js';

import { forbidden, unauthorized } from './errors.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  roles: Role[];
  employeeId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Reads the session cookie and attaches the user.
 *
 * The token's tokenVersion is checked against the stored one, so changing a
 * user's roles or deactivating them invalidates tokens already issued instead
 * of waiting eight hours for expiry (guardrail 10.2).
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  void (async () => {
    try {
      const cookies = req.cookies as Record<string, string | undefined>;
      const token = cookies[SESSION_COOKIE];

      if (token === undefined || token.length === 0) {
        next(unauthorized());
        return;
      }

      const claims = verifySession(token);
      if (claims === null) {
        next(unauthorized('Session expired or invalid'));
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: {
          id: true,
          email: true,
          roles: true,
          employeeId: true,
          status: true,
          tokenVersion: true,
        },
      });

      if (user?.status !== 'ACTIVE') {
        next(unauthorized('Account is not active'));
        return;
      }

      if (user.tokenVersion !== claims.tokenVersion) {
        next(unauthorized('Session is no longer valid, please sign in again'));
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        roles: user.roles,
        employeeId: user.employeeId,
      };
      next();
    } catch (error) {
      next(error);
    }
  })();
};

export function getUser(req: Request): AuthenticatedUser {
  if (req.user === undefined) {
    // requireAuth always runs first; reaching here is a wiring mistake.
    throw unauthorized();
  }
  return req.user;
}

/**
 * Declares the permission a route needs.
 *
 * Every mutating route must carry one of these. `assertRoutesGuarded` checks
 * that at startup, so a route cannot ship without declaring its access
 * (guardrail 10.2, rule R1).
 */
export function requirePermission(
  action: Action,
  resource: Resource,
): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    const user = getUser(req);
    if (!can(user.roles, action, resource)) {
      next(forbidden(`Not permitted to ${action} ${resource}`));
      return;
    }
    next();
  };

  // Marked so the startup assertion can recognise a guarded route.
  Object.defineProperty(handler, 'payzGuard', {
    value: { action, resource },
    enumerable: false,
  });

  return handler;
}

export function requireRole(minimum: Role): RequestHandler {
  const handler: RequestHandler = (req, _res, next) => {
    const user = getUser(req);
    if (!atLeast(user.roles, minimum)) {
      next(forbidden(`Requires ${minimum} or higher`));
      return;
    }
    next();
  };

  Object.defineProperty(handler, 'payzGuard', {
    value: { role: minimum },
    enumerable: false,
  });

  return handler;
}

/**
 * The ownership filter for the EMPLOYEE role.
 *
 * Returns a Prisma `where` fragment restricting results to the caller's own
 * employee record. The client never supplies this filter, so it cannot be
 * tampered with (rule R2).
 */
export function selfScope(
  req: Request,
  field = 'employeeId',
): Record<string, number> | Record<string, never> {
  const user = getUser(req);
  if (!isSelfScoped(user.roles)) {
    return {};
  }
  if (user.employeeId === null) {
    // A self-scoped account with no employee link can own nothing. Match
    // nothing rather than accidentally matching everything.
    throw forbidden('This account is not linked to an employee record');
  }
  return { [field]: user.employeeId };
}

/**
 * True when the caller may only act on their own records.
 *
 * Both sides are numbers, and they have to stay that way. `1 !== '1'` is true,
 * so a stray string on either side turns this into a check that refuses
 * everybody -- annoying, but at least loud.
 */
export function mustBeSelf(req: Request, employeeId: number): void {
  const user = getUser(req);
  if (isSelfScoped(user.roles) && user.employeeId !== employeeId) {
    throw forbidden('You may only access your own records');
  }
}

/**
 * An employee can never approve their own request, whatever role they hold
 * (rule T8).
 *
 * This one fails the other way from `mustBeSelf`, which is why the types
 * matter more here: `1 === '1'` is false, so a stray string would make this
 * check pass silently and let an employee approve their own leave. Both sides
 * are numbers and the compiler now refuses anything else.
 */
export function refuseSelfApproval(
  req: Request,
  requestEmployeeId: number,
): void {
  const user = getUser(req);
  if (user.employeeId !== null && user.employeeId === requestEmployeeId) {
    throw forbidden('You cannot approve your own request');
  }
}

export type { NextFunction, Response };
