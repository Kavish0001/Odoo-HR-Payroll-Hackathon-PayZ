import { type Role } from '@payz/shared';
import bcrypt from 'bcryptjs';
import { type CookieOptions, type Response } from 'express';
import jwt from 'jsonwebtoken';

import { env, isProduction } from '../../config/env.js';

export const SESSION_COOKIE = 'payz_session';

/** Eight hours: long enough for a working day, short enough to matter. */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Cost 12: ~250ms per hash, which is the point. */
const BCRYPT_ROUNDS = 12;

export interface SessionClaims {
  /**
   * The user's row id. JWT convention says `sub` is a string, but keeping it
   * numeric here means the ownership checks in `middleware/auth.ts` compare
   * number to number with no conversion step to forget.
   *
   * Cookies issued before the integer migration carry a cuid here, which
   * matches no user row and so fails closed to a 401 -- a forced sign-out,
   * which is the safe direction for a claim that grants access.
   */
  sub: number;
  email: string;
  roles: Role[];
  employeeId: number | null;
  /** Invalidates the token when roles or status change (guardrail 10.2). */
  tokenVersion: number;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Constant-ish work even when no user exists, so a wrong email and a wrong
 * password take comparable time and cannot be told apart by timing
 * (guardrail 10.2).
 */
const DUMMY_HASH =
  '$2a$12$C6UzMDM.H6dfI/f/IKcEeO.ThisIsADummyHashForTimingOnly.';

export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  if (hash === null) {
    await bcrypt.compare(plain, DUMMY_HASH).catch(() => false);
    return false;
  }
  return verifyPassword(plain, hash);
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, env.JWT_SECRET, {
    expiresIn: SESSION_TTL_SECONDS,
    issuer: 'payz',
  });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'payz' });
    if (typeof decoded === 'string') {
      return null;
    }
    return decoded as unknown as SessionClaims;
  } catch {
    return null;
  }
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // 'lax' plus the Origin check on mutating routes is the CSRF defence
    // (guardrail 10.1).
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, options);
}
