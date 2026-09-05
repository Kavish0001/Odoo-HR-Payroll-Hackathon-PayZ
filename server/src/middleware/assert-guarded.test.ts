import { Router } from 'express';
import { describe, expect, it } from 'vitest';

import { assertRoutesGuarded, type RouterMount } from './assert-guarded.js';
import { requireAuth, requirePermission } from './auth.js';

/**
 * The assertion exists to stop an unguarded mutating route from shipping.
 * These tests prove it actually fails when one does, since an assertion that
 * never fires is decoration.
 */

function mountsWith(build: (router: Router) => void): RouterMount[] {
  const router = Router();
  build(router);
  return [{ prefix: '/api/test', router }];
}

describe('assertRoutesGuarded', () => {
  it('rejects a POST route with no permission declared', () => {
    const mounts = mountsWith((router) => {
      router.post('/things', (_req, res) => res.status(201).end());
    });

    expect(() => {
      assertRoutesGuarded(mounts);
    }).toThrow(/POST \/api\/test\/things/);
  });

  it.each(['put', 'patch', 'delete'] as const)(
    'rejects an unguarded %s route',
    (method) => {
      const mounts = mountsWith((router) => {
        router[method]('/things/:id', (_req, res) => res.status(204).end());
      });

      expect(() => {
        assertRoutesGuarded(mounts);
      }).toThrow(new RegExp(method.toUpperCase()));
    },
  );

  it('accepts a route carrying requireAuth and requirePermission', () => {
    const mounts = mountsWith((router) => {
      router.post(
        '/things',
        requireAuth,
        requirePermission('create', 'employee'),
        (_req, res) => res.status(201).end(),
      );
    });

    expect(() => {
      assertRoutesGuarded(mounts);
    }).not.toThrow();
  });

  it('rejects a route with requireAuth but no permission', () => {
    // Authenticated is not the same as authorised: without a permission any
    // signed-in user, including a plain EMPLOYEE, could call it.
    const mounts = mountsWith((router) => {
      router.post('/things', requireAuth, (_req, res) => res.status(201).end());
    });

    expect(() => {
      assertRoutesGuarded(mounts);
    }).toThrow(/declare no permission/);
  });

  it('ignores GET routes, which are scoped by the service layer', () => {
    const mounts = mountsWith((router) => {
      router.get('/things', (_req, res) => res.json([]));
    });

    expect(() => {
      assertRoutesGuarded(mounts);
    }).not.toThrow();
  });

  it('reports every offending route at once, not just the first', () => {
    const mounts = mountsWith((router) => {
      router.post('/a', (_req, res) => res.end());
      router.delete('/b', (_req, res) => res.end());
    });

    try {
      assertRoutesGuarded(mounts);
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('/api/test/a');
      expect(message).toContain('/api/test/b');
    }
  });
});
