import { type Action, type Resource, type Role } from '@payz/shared';
import { type Router } from 'express';

import { logger } from '../config/logger.js';

/**
 * Startup assertion: no mutating route may ship without declaring its access.
 *
 * Reviewing every new POST for a missing requirePermission does not scale over
 * twenty-four hours, and a route that forgets one is silently open to any
 * signed-in user. This walks the registered routers at boot and refuses to
 * start if a mutating route carries no guard (guardrail 10.2, rule R1).
 *
 * Mounts are passed in rather than recovered from Express internals. Express 5
 * replaced the layer regexp with a matcher function and only populates `path`
 * after a match, so reconstructing the prefix from the stack is guesswork that
 * would silently start passing if the internals shift again.
 */

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

/**
 * Routes that are deliberately open. Each carries the reason, so adding one is
 * a decision rather than a shortcut.
 */
const PUBLIC_ROUTES = new Map<string, string>([
  ['POST /api/auth/login', 'Sign-in cannot require a session'],
  ['POST /api/auth/logout', 'Clearing a cookie is harmless'],
  [
    'POST /api/auth/change-password',
    'Guarded by requireAuth plus the current-password check',
  ],
]);

export interface RouterMount {
  prefix: string;
  router: Router;
}

interface GuardMarker {
  payzGuard?: unknown;
}

/** What a route declared, as `requirePermission`/`requireRole` recorded it. */
export interface DeclaredGuard {
  action?: Action;
  resource?: Resource;
  role?: Role;
}

export interface RouteGuard {
  /** e.g. `POST /api/time-off/requests/:id/approve`. */
  label: string;
  guards: DeclaredGuard[];
}

interface RouteLayer {
  route?: {
    path?: unknown;
    stack?: { handle?: unknown }[];
    methods?: Record<string, boolean>;
  };
  handle?: unknown;
}

function isGuarded(handlers: readonly unknown[]): boolean {
  return handlers.some(
    (handler) =>
      typeof handler === 'function' &&
      (handler as GuardMarker).payzGuard !== undefined,
  );
}

function isAuthenticated(handlers: readonly unknown[]): boolean {
  return handlers.some(
    (handler) =>
      typeof handler === 'function' && handler.name === 'requireAuth',
  );
}

function joinPath(prefix: string, path: string): string {
  return `${prefix}${path}`.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

function readGuards(handlers: readonly unknown[]): DeclaredGuard[] {
  return handlers
    .map((handler) =>
      typeof handler === 'function'
        ? (handler as GuardMarker).payzGuard
        : undefined,
    )
    .filter((guard): guard is DeclaredGuard => guard !== undefined);
}

/**
 * Every registered route with the permission it declares.
 *
 * The startup assertion only asks whether a guard exists. This reports which
 * one, so a test can pin the permissions that are easy to weaken by accident
 * -- an approval route quietly guarded by 'update' reads as guarded, and for
 * a while one was.
 */
export function describeRouteGuards(
  mounts: readonly RouterMount[],
): RouteGuard[] {
  const routes: RouteGuard[] = [];

  for (const mount of mounts) {
    const stack = (mount.router as unknown as { stack?: RouteLayer[] }).stack;
    if (!Array.isArray(stack)) {
      throw new Error('Cannot inspect the router stack to read route guards.');
    }

    for (const layer of stack) {
      if (layer.route === undefined) {
        continue;
      }
      const path = typeof layer.route.path === 'string' ? layer.route.path : '';
      const full = joinPath(mount.prefix, path);
      const guards = readGuards(
        (layer.route.stack ?? []).map((entry) => entry.handle),
      );

      for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
        if (enabled) {
          routes.push({ label: `${method.toUpperCase()} ${full}`, guards });
        }
      }
    }
  }

  return routes;
}

function collectUnguarded(mount: RouterMount, found: string[]): void {
  const stack = (mount.router as unknown as { stack?: RouteLayer[] }).stack;

  if (!Array.isArray(stack)) {
    throw new Error(
      'Cannot inspect the router stack to verify route guards. The assertion must be updated before this build ships.',
    );
  }

  for (const layer of stack) {
    if (layer.route === undefined) {
      // A nested router. Its own mount registers separately.
      continue;
    }

    const path = typeof layer.route.path === 'string' ? layer.route.path : '';
    const full = joinPath(mount.prefix, path);
    const handlers = (layer.route.stack ?? []).map((entry) => entry.handle);

    for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
      if (!enabled || !MUTATING.has(method)) {
        continue;
      }

      const label = `${method.toUpperCase()} ${full}`;
      if (PUBLIC_ROUTES.has(label)) {
        continue;
      }

      // Authenticated is not the same as authorised: without a declared
      // permission, any signed-in user could call it, EMPLOYEE included.
      if (!isAuthenticated(handlers) || !isGuarded(handlers)) {
        found.push(label);
      }
    }
  }
}

export function assertRoutesGuarded(mounts: readonly RouterMount[]): void {
  const unguarded: string[] = [];

  for (const mount of mounts) {
    collectUnguarded(mount, unguarded);
  }

  if (unguarded.length > 0) {
    throw new Error(
      [
        'These mutating routes declare no permission:',
        ...unguarded.map((route) => `  - ${route}`),
        '',
        'Add requireAuth and requirePermission(action, resource), or record',
        'the route in PUBLIC_ROUTES with the reason it is open.',
      ].join('\n'),
    );
  }

  logger.debug(`Route guard assertion passed for ${mounts.length} mounts`);
}
