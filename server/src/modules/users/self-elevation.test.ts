import { describe, expect, it } from 'vitest';

import { refuseSelfElevation } from './self-elevation.js';

const ME = 1;
const SOMEONE_ELSE = 2;

describe('refuseSelfElevation', () => {
  it('refuses granting yourself a role', () => {
    expect(() => {
      refuseSelfElevation(ME, ME, { roles: ['ADMIN'] });
    }).toThrow(/your own roles/i);
  });

  // Re-asserting the roles you already hold is still a write to your own
  // grant, and a rule that inspects the values is a rule that can be fooled.
  it('refuses a no-op change to your own roles', () => {
    expect(() => {
      refuseSelfElevation(ME, ME, { roles: ['EMPLOYEE'] });
    }).toThrow();
  });

  it('refuses changing your own account status', () => {
    expect(() => {
      refuseSelfElevation(ME, ME, { status: 'INACTIVE' });
    }).toThrow(/account status/i);
  });

  it('allows changing your own email or password', () => {
    expect(() => {
      refuseSelfElevation(ME, ME, {});
    }).not.toThrow();
  });

  it('allows an administrator to act on somebody else', () => {
    expect(() => {
      refuseSelfElevation(ME, SOMEONE_ELSE, {
        roles: ['ADMIN'],
        status: 'ACTIVE',
      });
    }).not.toThrow();
  });

  it('refuses with 403, not 400: the request is understood and declined', () => {
    try {
      refuseSelfElevation(ME, ME, { roles: ['ADMIN'] });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as { status?: number }).status).toBe(403);
    }
  });
});
