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

  it('still carries HR duties forward, which are not payroll', () => {
    // Read-only in payroll does not mean read-only everywhere: the role sits
    // above HR Manager and keeps that work.
    expect(can(payrollUser, 'create', 'employee')).toBe(true);
    expect(can(payrollUser, 'approve', 'timeOffRequest')).toBe(true);
  });

  /**
   * The payroll pair is split by who may move money, not by how much of it
   * they can see. `update` on a payrun is Compute, Validate, Mark Paid,
   * Cancel, Send Payslips and acknowledging a blocking warning -- so a role
   * holding it can pay the whole company. That belongs to the manager.
   */
  it('gives the payroll user reads across payroll and nothing else', () => {
    for (const resource of [
      'payrun',
      'payslip',
      'salaryStructure',
      'salaryRule',
    ] as const) {
      expect(can(payrollUser, 'read', resource)).toBe(true);
      for (const action of ['create', 'update', 'delete'] as const) {
        expect(
          can(payrollUser, action, resource),
          `payroll user must not ${action} ${resource}`,
        ).toBe(false);
      }
    }
    expect(can(payrollUser, 'read', 'dashboard')).toBe(true);
  });

  it('keeps every payroll write with the payroll manager', () => {
    for (const resource of [
      'payrun',
      'payslip',
      'salaryStructure',
      'salaryRule',
    ] as const) {
      for (const action of ['create', 'update'] as const) {
        expect(
          can(payrollManager, action, resource),
          `payroll manager must ${action} ${resource}`,
        ).toBe(true);
      }
    }
  });

  it('gives the payroll manager every payroll write short of deleting', () => {
    expect(can(payrollManager, 'update', 'salaryRule')).toBe(true);
    expect(can(payrollManager, 'create', 'payrun')).toBe(true);
    expect(can(payrollManager, 'update', 'payrun')).toBe(true);
    // Removing the record itself is ADMIN's -- see the destructive-delete
    // group below.
    expect(can(payrollManager, 'delete', 'payrun')).toBe(false);
  });

  it('still separates the two: the user sees what the manager runs', () => {
    // Read parity is the point of the pair -- an auditor who cannot see the
    // payrun they are auditing is useless, and one who can validate it is
    // not an auditor.
    for (const resource of ['payrun', 'payslip', 'dashboard'] as const) {
      expect(can(payrollUser, 'read', resource)).toBe(
        can(payrollManager, 'read', resource),
      );
    }
    expect(can(payrollUser, 'update', 'payrun')).toBe(false);
    expect(can(payrollManager, 'update', 'payrun')).toBe(true);
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

describe('destroying a record is the administrator alone', () => {
  /**
   * Every one of these is either history somebody may have to answer for or
   * an input a payslip was computed from. The roles that work with them all
   * day have a non-destructive way to reach the same outcome -- correct the
   * attendance row, deactivate the rule, cancel the payrun -- so removing
   * the row itself is a separate and much rarer decision.
   */
  const destructive = [
    'contract',
    'attendance',
    'salaryRule',
    'payrun',
  ] as const;

  it('refuses delete to every role below admin', () => {
    for (const resource of destructive) {
      for (const role of ROLES) {
        expect(
          can([role], 'delete', resource),
          `${role} deleting ${resource}`,
        ).toBe(role === 'ADMIN');
      }
    }
  });

  it('leaves the everyday, non-destructive path where it was', () => {
    // The point is that nobody loses the ability to do their job.
    expect(can(['HR_MANAGER'], 'update', 'attendance')).toBe(true);
    expect(can(['HR_PAYROLL_MANAGER'], 'update', 'payrun')).toBe(true);
    expect(can(['HR_PAYROLL_MANAGER'], 'update', 'salaryRule')).toBe(true);
    expect(can(['HR_MANAGER'], 'update', 'contract')).toBe(true);
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
