import { describe, expect, it } from 'vitest';

import { ROLES, type Role } from './enums.js';
import {
  ACTIONS,
  RESOURCES,
  atLeast,
  can,
  isSelfScoped,
  ownRecordsOnly,
  requiredRoleFor,
} from './rbac.js';

describe('role hierarchy', () => {
  it('lets a higher role do anything a lower one can', () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        let seenAllowed = false;
        for (const role of ROLES) {
          const allowed = can([role], action, resource);
          if (allowed) {
            seenAllowed = true;
          } else if (seenAllowed) {
            throw new Error(
              `${role} cannot ${action} ${resource} but a lower role can`,
            );
          }
        }
      }
    }
  });
});

describe('HR Manager has no payroll access (rule R3)', () => {
  const hrManager: Role[] = ['HR_MANAGER'];

  it('refuses payruns, payslips and the dashboard', () => {
    expect(can(hrManager, 'read', 'payrun')).toBe(false);
    expect(can(hrManager, 'read', 'payslip')).toBe(false);
    expect(can(hrManager, 'read', 'dashboard')).toBe(false);
    expect(can(hrManager, 'read', 'salaryStructure')).toBe(false);
  });

  it('still allows full HR master data', () => {
    expect(can(hrManager, 'create', 'employee')).toBe(true);
    expect(can(hrManager, 'update', 'contract')).toBe(true);
    expect(can(hrManager, 'update', 'timeOffRequest')).toBe(true);
    expect(can(hrManager, 'create', 'workingSchedule')).toBe(true);
  });
});

describe('payroll roles (rule R4)', () => {
  const payrollUser: Role[] = ['HR_PAYROLL_USER'];
  const payrollManager: Role[] = ['HR_PAYROLL_MANAGER'];

  it('gives the payroll user read-only structures and rules', () => {
    expect(can(payrollUser, 'read', 'salaryStructure')).toBe(true);
    expect(can(payrollUser, 'update', 'salaryStructure')).toBe(false);
    expect(can(payrollUser, 'create', 'salaryRule')).toBe(false);
  });

  it('gives the payroll user create and update on payruns and payslips', () => {
    expect(can(payrollUser, 'create', 'payrun')).toBe(true);
    expect(can(payrollUser, 'update', 'payslip')).toBe(true);
    expect(can(payrollUser, 'delete', 'payrun')).toBe(false);
  });

  it('gives the payroll manager full control', () => {
    expect(can(payrollManager, 'update', 'salaryRule')).toBe(true);
    expect(can(payrollManager, 'delete', 'payrun')).toBe(true);
  });

  it('carries HR Manager permissions forward', () => {
    expect(can(payrollUser, 'create', 'employee')).toBe(true);
    expect(can(payrollUser, 'update', 'contract')).toBe(true);
  });
});

describe('employee role (rule R2)', () => {
  const employee: Role[] = ['EMPLOYEE'];

  it('may record own attendance and leave requests', () => {
    expect(can(employee, 'create', 'attendance')).toBe(true);
    expect(can(employee, 'create', 'timeOffRequest')).toBe(true);
  });

  it('may not administer HR or touch payroll', () => {
    expect(can(employee, 'create', 'employee')).toBe(false);
    expect(can(employee, 'read', 'contract')).toBe(false);
    expect(can(employee, 'read', 'payslip')).toBe(false);
    expect(can(employee, 'read', 'dashboard')).toBe(false);
    expect(can(employee, 'create', 'timeOffAllocation')).toBe(false);
  });

  it('is the only role scoped to its own records', () => {
    expect(isSelfScoped(employee)).toBe(true);
    expect(isSelfScoped(['HR_MANAGER'])).toBe(false);
    expect(isSelfScoped(['EMPLOYEE', 'HR_MANAGER'])).toBe(false);
  });
});

describe('user management is admin only (rule R5)', () => {
  // Every action, not just the two that were easy to think of: a matrix row
  // is edited under time pressure, and 'create' is the one that hands out
  // roles.
  it('refuses every non-admin role, for every action', () => {
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        // An action the row does not define is nobody's, the admin's
        // included: the matrix fails closed rather than granting by rank.
        const expected =
          role === 'ADMIN' && requiredRoleFor(action, 'user') !== undefined;
        expect(can([role], action, 'user')).toBe(expected);
      }
    }
  });

  // Ranks are compared, not memberships, so a role list must not become more
  // powerful than its strongest member.
  it('cannot be reached by combining lesser roles', () => {
    const everyoneBelowAdmin = ROLES.filter((role) => role !== 'ADMIN');
    for (const action of ACTIONS) {
      expect(can(everyoneBelowAdmin, action, 'user')).toBe(false);
    }
  });
});

describe('approving is not updating (rule T8)', () => {
  const employee: Role[] = ['EMPLOYEE'];

  // The distinction this pair of assertions protects is the whole reason
  // 'approve' exists. An employee needs 'update' on a time off request to
  // correct their own before anyone has decided it -- and for a while that
  // same permission was what the approve route asked for, which handed every
  // employee the power to approve a colleague's leave.
  it('lets an employee edit a request but never decide one', () => {
    expect(can(employee, 'update', 'timeOffRequest')).toBe(true);
    expect(can(employee, 'approve', 'timeOffRequest')).toBe(false);
  });

  it('gives approval to HR Manager and above, on both leave resources', () => {
    for (const resource of ['timeOffRequest', 'timeOffAllocation'] as const) {
      expect(can(['HR_MANAGER'], 'approve', resource)).toBe(true);
      expect(can(['HR_PAYROLL_MANAGER'], 'approve', resource)).toBe(true);
      expect(can(employee, 'approve', resource)).toBe(false);
    }
  });
});

describe('self-service actions', () => {
  it('lets anyone read their own payslip without opening the batch', () => {
    expect(can(['EMPLOYEE'], 'readSelf', 'payslip')).toBe(true);
    expect(can(['EMPLOYEE'], 'read', 'payslip')).toBe(false);
    // Rule R3 survives: an HR Manager still has no payroll access, and the
    // route pairs readSelf with an ownership check rather than a rank test.
    expect(can(['HR_MANAGER'], 'read', 'payslip')).toBe(false);
    expect(ownRecordsOnly(['HR_MANAGER'], 'payslip')).toBe(true);
    expect(ownRecordsOnly(['HR_PAYROLL_USER'], 'payslip')).toBe(false);
  });

  it('lets anyone correct their own details but not administer employees', () => {
    expect(can(['EMPLOYEE'], 'updateSelf', 'employee')).toBe(true);
    expect(can(['EMPLOYEE'], 'update', 'employee')).toBe(false);
    expect(ownRecordsOnly(['EMPLOYEE'], 'employee', 'update')).toBe(true);
    expect(ownRecordsOnly(['HR_MANAGER'], 'employee', 'update')).toBe(false);
  });
});

describe('failing closed', () => {
  it('denies when a role list is empty', () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        expect(can([], action, resource)).toBe(false);
      }
    }
  });

  it('takes the highest of several roles', () => {
    expect(
      can(['EMPLOYEE', 'HR_PAYROLL_MANAGER'], 'update', 'salaryRule'),
    ).toBe(true);
    expect(atLeast(['EMPLOYEE', 'HR_MANAGER'], 'HR_MANAGER')).toBe(true);
    expect(atLeast(['EMPLOYEE'], 'HR_MANAGER')).toBe(false);
  });
});
