import { type Action, type Resource } from '@payz/shared';
import { NavLink } from 'react-router-dom';

import { AttendanceWidget } from '../components/attendance/AttendanceWidget.js';
import { Logo } from '../components/brand/Logo.js';
import { useAuth } from '../lib/auth.js';

interface NavChild {
  label: string;
  to: string;
  permission: [Action, Resource];
}

interface NavItem {
  label: string;
  to?: string;
  permission: [Action, Resource];
  children?: NavChild[];
}

/**
 * The navbar from the wireframe, exactly:
 *   Employees v | Contracts v | Attendance | Time Off v | Payroll v
 *
 * Time Off pages are reachable only from this dropdown, never as separate
 * page buttons, which the wireframe calls out explicitly.
 */
const NAV: NavItem[] = [
  {
    label: 'Employees',
    permission: ['read', 'employee'],
    children: [
      {
        label: 'Employees',
        to: '/employees',
        permission: ['read', 'employee'],
      },
      {
        label: 'Departments',
        to: '/departments',
        permission: ['read', 'department'],
      },
      {
        label: 'Working Schedule',
        to: '/working-schedules',
        permission: ['read', 'workingSchedule'],
      },
    ],
  },
  {
    label: 'Contracts',
    permission: ['read', 'contract'],
    children: [
      {
        label: 'Contracts',
        to: '/contracts',
        permission: ['read', 'contract'],
      },
    ],
  },
  {
    label: 'Attendance',
    to: '/attendance',
    permission: ['read', 'attendance'],
  },
  {
    label: 'Time Off',
    permission: ['read', 'timeOffRequest'],
    children: [
      {
        label: 'Time Offs',
        to: '/time-off/requests',
        permission: ['read', 'timeOffRequest'],
      },
      {
        label: 'Allocations',
        to: '/time-off/allocations',
        permission: ['read', 'timeOffAllocation'],
      },
      {
        label: 'Time Off Types',
        to: '/time-off/types',
        permission: ['read', 'timeOffType'],
      },
    ],
  },
  {
    label: 'Payroll',
    permission: ['read', 'payrun'],
    children: [
      {
        label: 'Dashboard',
        to: '/dashboard',
        permission: ['read', 'dashboard'],
      },
      {
        label: 'Payruns',
        to: '/payroll/payruns',
        permission: ['read', 'payrun'],
      },
      {
        label: 'Payslips',
        to: '/payroll/payslips',
        permission: ['read', 'payslip'],
      },
      {
        label: 'Structures',
        to: '/payroll/structures',
        permission: ['read', 'salaryStructure'],
      },
      {
        label: 'Rules',
        to: '/payroll/rules',
        permission: ['read', 'salaryRule'],
      },
    ],
  },
];

const linkClass = (isActive: boolean): string =>
  `rounded-md px-3 py-1.5 text-sm ${
    isActive ? 'bg-metal-300/40 font-medium' : 'hover:bg-line/60'
  }`;

export function Navbar(): React.JSX.Element {
  const { user, allowed, signOut } = useAuth();

  // Hiding is a courtesy, not the enforcement point: the API re-checks every
  // request regardless of what the navbar shows.
  const visible = NAV.filter((item) => allowed(...item.permission));

  return (
    <header className="border-line bg-raised sticky top-0 z-20 border-b">
      <nav className="flex h-14 items-center gap-1 px-4">
        <NavLink to="/employees" className="mr-4 flex items-center gap-2">
          <Logo size={28} />
          <span className="text-base font-bold tracking-tight">PayZ</span>
        </NavLink>

        {visible.map((item) =>
          item.children === undefined ? (
            <NavLink
              key={item.label}
              to={item.to ?? '/'}
              className={({ isActive }) => linkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ) : (
            <div key={item.label} className="group relative">
              <button
                type="button"
                className="hover:bg-line/60 rounded-md px-3 py-1.5 text-sm"
              >
                {item.label} <span aria-hidden="true">&#9662;</span>
              </button>
              <div className="border-line bg-raised invisible absolute left-0 z-30 mt-1 min-w-44 rounded-md border py-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {item.children
                  .filter((child) => allowed(...child.permission))
                  .map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 text-sm ${
                          isActive
                            ? 'bg-metal-300/40 font-medium'
                            : 'hover:bg-line/60'
                        }`
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          ),
        )}

        <div className="ml-auto flex items-center gap-3">
          <AttendanceWidget />
          <div className="text-right leading-tight">
            <div className="text-sm font-medium">
              {user?.employeeName ?? user?.email}
            </div>
            {user?.departmentName != null && (
              <div className="text-muted text-xs">{user.departmentName}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="border-line hover:bg-line/60 rounded-md border px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
