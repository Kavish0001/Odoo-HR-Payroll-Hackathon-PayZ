import { isSelfScoped, type SessionUser } from '@payz/shared';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges conditional class names and resolves Tailwind conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Two-letter initials from a full name, for avatar chips. */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Where signing in should land you.
 *
 * `/employees` is the right home for anyone who administers people. For an
 * employee it is a directory of one row -- themselves -- under the heading
 * "Everyone in the organisation", which is both useless and untrue. They get
 * their own record instead.
 */
export function homePathFor(user: SessionUser | null): string {
  if (user !== null && isSelfScoped(user.roles) && user.employeeId !== null) {
    return `/employees/${user.employeeId}`;
  }
  return '/employees';
}
