import { ROLE_RANK, type Role } from './enums.js';

/**
 * The permission model, stated once.
 *
 * The client imports this to decide what to render; the API imports the same
 * table to decide what to allow. They cannot disagree about who may do what.
 *
 * This is a convenience, not the enforcement point. Every mutating route also
 * declares its required roles, and a route that declares none fails a startup
 * assertion (guardrail 10.2, rule R1). Hiding a button is never security.
 */

export const RESOURCES = [
  'employee',
  'department',
  'jobPosition',
  'workingSchedule',
  'contract',
  'attendance',
  'timeOffType',
  'timeOffAllocation',
  'timeOffRequest',
  'salaryStructure',
  'salaryRule',
  'payrun',
  'payslip',
  'dashboard',
  'user',
] as const;
export type Resource = (typeof RESOURCES)[number];

/**
 * `readSelf` and `updateSelf` exist because a rank ladder alone cannot say
 * "your own record, but nobody else's". An employee must see their own
 * payslip while an HR Manager sees none (rule R3), which is not a monotonic
 * rank -- so the self-service capability is its own action, and the route
 * pairs it with an ownership check.
 *
 * `approve` is separate from `update` for the same reason in reverse: an
 * employee may edit their own pending leave request, and that must never be
 * the same permission as deciding somebody else's (rule T8).
 */
export const ACTIONS = [
  'read',
  'readSelf',
  'create',
  'update',
  'updateSelf',
  'approve',
  'delete',
] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * The minimum role rank required for each action on each resource.
 *
 * `delete` sits at ADMIN across the destructive records -- contract,
 * attendance, salary rule, payrun. Every one of them is either history
 * somebody may need to answer for later or an input a payslip was computed
 * from, and the roles that work with them day to day have a non-destructive
 * way to get the same result: correct the attendance row, deactivate the
 * rule, cancel the payrun. Removing the row itself is a separate decision,
 * and a rarer one.
 */
const MATRIX: Record<Resource, Partial<Record<Action, Role>>> = {
  // HR master data: HR Manager and above have full control.
  employee: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    // Anyone may correct their own contact and bank details. The route
    // narrows the payload to those columns, so this cannot move a department
    // or reactivate a leaver (rule R2).
    updateSelf: 'EMPLOYEE',
    delete: 'ADMIN',
  },
  department: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    delete: 'ADMIN',
  },
  jobPosition: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    delete: 'ADMIN',
  },
  workingSchedule: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    delete: 'ADMIN',
  },
  contract: {
    read: 'HR_MANAGER',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    delete: 'ADMIN',
  },

  // An employee may record their own attendance and leave, which is why
  // create is open here but the query is scoped to self (rule R2).
  attendance: {
    read: 'EMPLOYEE',
    create: 'EMPLOYEE',
    update: 'HR_MANAGER',
    // Destroying a record is not the same as correcting one. HR corrects an
    // attendance row by editing it, which keeps the history; removing it
    // outright is the administrator's call (see the note on `delete` below).
    delete: 'ADMIN',
  },
  timeOffRequest: {
    read: 'EMPLOYEE',
    create: 'EMPLOYEE',
    // Editing is scoped to the caller's own pending request by the route.
    update: 'EMPLOYEE',
    // Deciding someone else's leave is a manager's act, never the
    // requester's (rule T8).
    approve: 'HR_MANAGER',
    delete: 'HR_MANAGER',
  },
  timeOffAllocation: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    approve: 'HR_MANAGER',
    delete: 'HR_MANAGER',
  },
  timeOffType: {
    read: 'EMPLOYEE',
    create: 'HR_MANAGER',
    update: 'HR_MANAGER',
    delete: 'ADMIN',
  },

  // Payroll configuration: payroll users read, payroll managers write
  // (rule R4).
  salaryStructure: {
    read: 'HR_PAYROLL_USER',
    create: 'HR_PAYROLL_MANAGER',
    update: 'HR_PAYROLL_MANAGER',
    delete: 'HR_PAYROLL_MANAGER',
  },
  salaryRule: {
    read: 'HR_PAYROLL_USER',
    create: 'HR_PAYROLL_MANAGER',
    update: 'HR_PAYROLL_MANAGER',
    delete: 'ADMIN',
  },

  // HR Manager has no payroll access at all (rule R3).
  //
  // The two payroll roles are split by whether they may *move* money, not by
  // how much of it they can see. HR Payroll User reads the whole of payroll --
  // payruns, payslips, structures, rules and the dashboard -- and changes
  // none of it. Running a payrun is HR Payroll Manager's alone.
  //
  // `update` on a payrun is not a small permission: it is Compute, Validate,
  // Mark Paid, Cancel, Send Payslips and acknowledging a blocking warning.
  // Granting it to a role named "user" made that role able to pay everybody.
  payrun: {
    read: 'HR_PAYROLL_USER',
    create: 'HR_PAYROLL_MANAGER',
    update: 'HR_PAYROLL_MANAGER',
    delete: 'ADMIN',
  },
  payslip: {
    read: 'HR_PAYROLL_USER',
    // Everyone sees their own pay. The payslip routes filter by the caller's
    // employee id whenever they lack the team-wide `read`, so this grants a
    // window onto one record and never onto the batch.
    readSelf: 'EMPLOYEE',
    create: 'HR_PAYROLL_MANAGER',
    update: 'HR_PAYROLL_MANAGER',
    delete: 'HR_PAYROLL_MANAGER',
  },
  dashboard: { read: 'HR_PAYROLL_USER' },

  // Only an admin manages accounts and roles (rule R5).
  user: {
    read: 'ADMIN',
    create: 'ADMIN',
    update: 'ADMIN',
    delete: 'ADMIN',
  },
};

export function highestRank(roles: readonly Role[]): number {
  return roles.reduce((max, role) => Math.max(max, ROLE_RANK[role]), -1);
}

export function can(
  roles: readonly Role[],
  action: Action,
  resource: Resource,
): boolean {
  const required = MATRIX[resource][action];
  if (required === undefined) {
    // Absent means nobody, not everybody. Failing closed is the only safe
    // default for a table someone will extend under time pressure.
    return false;
  }
  return highestRank(roles) >= ROLE_RANK[required];
}

export function hasRole(roles: readonly Role[], role: Role): boolean {
  return roles.includes(role);
}

export function atLeast(roles: readonly Role[], role: Role): boolean {
  return highestRank(roles) >= ROLE_RANK[role];
}

/**
 * True when the caller only ever sees their own records. Used by services to
 * decide whether to inject the ownership filter, and by the client to hide
 * team-wide views.
 */
export function isSelfScoped(roles: readonly Role[]): boolean {
  return highestRank(roles) === ROLE_RANK.EMPLOYEE;
}

/**
 * True when the caller holds the self-service permission on a resource but
 * not the team-wide one, and must therefore be shown -- and served -- only
 * their own records.
 *
 * This is the counterpart to `isSelfScoped`, which asks about the *role*.
 * This asks about the *resource*, which is the question payslips need: an HR
 * Manager is not self-scoped, yet still sees only their own payslip.
 */
export function ownRecordsOnly(
  roles: readonly Role[],
  resource: Resource,
  action: Action = 'read',
): boolean {
  return !can(roles, action, resource);
}

export const requiredRoleFor = (
  action: Action,
  resource: Resource,
): Role | undefined => MATRIX[resource][action];
