import { can, type Role } from '@payz/shared';
import { describe, expect, it } from 'vitest';

import {
  describeRouteGuards,
  type RouterMount,
} from '../middleware/assert-guarded.js';

import { employeesRouter } from './employees/employees.routes.js';
import { payslipsRouter } from './payruns/payslips.routes.js';
import { allocationsRouter } from './timeoff/allocations.routes.js';
import { timeOffRequestsRouter } from './timeoff/time-off-requests.routes.js';

/**
 * The permissions a route declares, asserted directly.
 *
 * `assertRoutesGuarded` only asks whether a guard is present, which every one
 * of these routes passed while declaring the wrong one. The gap it missed:
 * approving leave was guarded by `update`, an action the matrix grants to
 * EMPLOYEE so a person can edit their own pending request -- so any employee
 * could approve a colleague's leave through the API, and was offered the
 * button for it in the UI.
 *
 * Reading the declaration rather than calling the route means these hold
 * without a database, which is the only way they run in this suite at all.
 */
const MOUNTS: RouterMount[] = [
  { prefix: '/api/time-off', router: timeOffRequestsRouter },
  { prefix: '/api/time-off', router: allocationsRouter },
  { prefix: '/api/payslips', router: payslipsRouter },
  { prefix: '/api/employees', router: employeesRouter },
];

const ROUTES = describeRouteGuards(MOUNTS);

function guardsFor(label: string): { action?: string; resource?: string }[] {
  const route = ROUTES.find((entry) => entry.label === label);
  if (route === undefined) {
    throw new Error(
      `No route ${label}. Registered: ${ROUTES.map((r) => r.label).join(', ')}`,
    );
  }
  return route.guards;
}

function declares(label: string, action: string, resource: string): boolean {
  return guardsFor(label).some(
    (guard) => guard.action === action && guard.resource === resource,
  );
}

describe('deciding leave is guarded as approval, not as editing (rule T8)', () => {
  it.each([
    'POST /api/time-off/requests/:id/approve',
    'POST /api/time-off/requests/:id/refuse',
  ])('%s requires approve on timeOffRequest', (label) => {
    expect(declares(label, 'approve', 'timeOffRequest')).toBe(true);
    // The specific mistake being kept out, named so a revert is obvious.
    expect(declares(label, 'update', 'timeOffRequest')).toBe(false);
  });

  it.each([
    'POST /api/time-off/allocations/:id/approve',
    'POST /api/time-off/allocations/:id/refuse',
  ])('%s requires approve on timeOffAllocation', (label) => {
    expect(declares(label, 'approve', 'timeOffAllocation')).toBe(true);
  });

  it('leaves no approval route reachable by an employee', () => {
    const employee: Role[] = ['EMPLOYEE'];
    for (const route of ROUTES) {
      if (!/\/(approve|refuse)$/.test(route.label)) {
        continue;
      }
      const reachable = route.guards.every((guard) =>
        guard.action !== undefined && guard.resource !== undefined
          ? can(employee, guard.action, guard.resource)
          : true,
      );
      expect(reachable, `${route.label} is open to an employee`).toBe(false);
    }
  });
});

describe('withdrawing your own request is not deleting somebody elses', () => {
  // Cancelling is guarded at the level an employee holds, because filing a
  // request you can never withdraw is not a workflow. The route itself then
  // requires ownership from anyone without 'delete'.
  it('lets an employee reach the cancel route', () => {
    const label = 'DELETE /api/time-off/requests/:id';
    expect(declares(label, 'update', 'timeOffRequest')).toBe(true);
    expect(can(['EMPLOYEE'], 'update', 'timeOffRequest')).toBe(true);
  });
});

describe('payslips are readable by their owner, and by payroll', () => {
  it.each([
    'GET /api/payslips',
    'GET /api/payslips/:id',
    'GET /api/payslips/:id/pdf',
  ])(
    '%s requires only readSelf, with ownership checked in the handler',
    (label) => {
      expect(declares(label, 'readSelf', 'payslip')).toBe(true);
    },
  );

  it('does not thereby open the batch to an HR Manager (rule R3)', () => {
    // The guard admits them; the route's own filter pins them to their own
    // employee id, which is what keeps R3 true.
    expect(can(['HR_MANAGER'], 'readSelf', 'payslip')).toBe(true);
    expect(can(['HR_MANAGER'], 'read', 'payslip')).toBe(false);
  });
});

describe('an employee may correct their own record, not administer any', () => {
  it('guards the employee update route at updateSelf', () => {
    const label = 'PATCH /api/employees/:id';
    expect(declares(label, 'updateSelf', 'employee')).toBe(true);
    expect(can(['EMPLOYEE'], 'updateSelf', 'employee')).toBe(true);
  });

  it('keeps create and delete out of an employee reach', () => {
    expect(declares('POST /api/employees', 'create', 'employee')).toBe(true);
    expect(declares('DELETE /api/employees/:id', 'delete', 'employee')).toBe(
      true,
    );
    expect(can(['EMPLOYEE'], 'create', 'employee')).toBe(false);
    expect(can(['EMPLOYEE'], 'delete', 'employee')).toBe(false);
  });
});
