import { forbidden } from '../../middleware/errors.js';

/**
 * Rule R5: nobody may assign or elevate their own roles.
 *
 * The permission matrix already limits every /api/users route to an
 * administrator, which keeps the other four roles out entirely. This covers
 * the case the matrix cannot: an administrator acting on their own account.
 * Being allowed to manage users is not the same as being allowed to manage
 * yourself, and the two failures it prevents are different in kind --
 * a compromised admin session quietly widening its own grant, and an
 * administrator demoting themselves and locking the last door behind them.
 *
 * Kept in its own module, away from the router, so the rule can be tested
 * without standing up Express or a database, and so it reads as a rule rather
 * than as a line of controller plumbing.
 */
export function refuseSelfElevation(
  actingUserId: number,
  targetUserId: number,
  body: { roles?: unknown; status?: unknown },
): void {
  if (actingUserId !== targetUserId) {
    return;
  }

  // Email and password are the caller's own to change; roles and status are
  // the grant itself, and changing your own grant is the thing being refused.
  if (body.roles !== undefined || body.status !== undefined) {
    throw forbidden(
      'You cannot change your own roles or account status. Ask another administrator.',
    );
  }
}
