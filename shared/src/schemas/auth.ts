import { z } from 'zod';

import { ROLES, USER_STATUSES, type Role } from '../enums.js';

import { emailSchema, idSchema, nonEmptyString } from './common.js';

export const loginSchema = z.object({
  email: emailSchema,
  // No composition rules on login: the stored password already met them at
  // creation, and rejecting here only leaks what the rules are.
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Minimum length only. Length beats character-class rules for real strength,
 * and a 12-character floor keeps bcrypt work meaningful.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'Too long');

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  // Optional, but linking to an employee is what gives an account ownership
  // of records for the EMPLOYEE role's own-records scoping (rule R2).
  employeeId: idSchema.nullish(),
  roles: z
    .array(z.enum(ROLES))
    .min(1, 'Assign at least one role')
    .refine((roles) => new Set(roles).size === roles.length, 'Duplicate role'),
  status: z.enum(USER_STATUSES).default('ACTIVE'),
});

/**
 * What a caller *sends*, not what the server reads back.
 *
 * `idSchema` coerces, so `z.infer` would describe `employeeId` as the number
 * the server ends up with, while the form that builds this payload holds the
 * string a `<select>` gave it. `z.input` is the side of the coercion the
 * client is actually on; the routes type their parsed body with `z.infer`
 * separately and so still see numbers.
 */
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = createUserSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: passwordSchema.optional(),
  });

export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: nonEmptyString('Current password'),
    newPassword: passwordSchema,
    confirmPassword: nonEmptyString('Confirmation'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** What the client learns about the signed-in user. Never includes the hash. */
export interface SessionUser {
  id: string;
  email: string;
  roles: Role[];
  employeeId: string | null;
  employeeName: string | null;
  departmentName: string | null;
}
