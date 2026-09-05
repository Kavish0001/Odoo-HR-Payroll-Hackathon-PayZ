import { isSelfScoped, type Action, type Resource } from '@payz/shared';
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
        label: 'Job Positions',
        to: '/job-positions',
        permission: ['read', 'jobPosition'],
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
      // The wireframe lists Dashboard first under Time Off.
      {
        label: 'Dashboard',
        to: '/time-off/dashboard',
        permission: ['read', 'timeOffRequest'],
      },
      {
        label: 'Time Offs',
        to: '/time-off/requests',
        permission: ['read', 'timeOffRequest'],
      },
      // Types before Allocations, as the wireframe orders them: you define a
      // type before you can allocate any of it.
      {
        label: 'Time Off Types',
        to: '/time-off/types',
        permission: ['read', 'timeOffType'],
      },
      {
        label: 'Allocations',
        to: '/time-off/allocations',
        permission: ['read', 'timeOffAllocation'],
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
        permission: ['readSelf', 'payslip'],
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

/**
 * What an employee gets instead.
 *
 * The same links, filtered by the same permissions, would technically work --
 * but they would be the wrong shape. An employee's "Employees" list contains
 * one row, themselves; the department and job-position catalogues are
 * reference data they cannot act on; and every screen they actually use is
 * about their own record. So the menu says what it is: my profile, my
 * attendance, my leave, my pay.
 *
 * `/employees/:id` needs their employee id, which is why this is a function
 * rather than a constant.
 */
function selfServiceNav(employeeId: string | null): NavItem[] {
  return [
    {
      label: 'My Profile',
      to: employeeId === null ? '/employees' : `/employees/${employeeId}`,
      permission: ['read', 'employee'],
    },
    {
      label: 'My Attendance',
      to: '/attendance',
      permission: ['read', 'attendance'],
    },
    {
      label: 'My Time Off',
      permission: ['read', 'timeOffRequest'],
      children: [
        {
          label: 'Balances',
          to: '/time-off/dashboard',
          permission: ['read', 'timeOffRequest'],
        },
        {
          label: 'My Requests',
          to: '/time-off/requests',
          permission: ['read', 'timeOffRequest'],
        },
      ],
    },
    {
      label: 'My Payslips',
      to: '/payroll/payslips',
      permission: ['readSelf', 'payslip'],
    },
  ];
}

/**
 * Nav items are monospace and uppercase, so navigation reads as machine
 * chrome rather than prose. The active item is marked by a red rule beneath
 * it: the same accent as the logo underline, and one of the very few places
 * red appears at all.
 */
const linkClass = (isActive: boolean): string =>
  [
    'font-mono relative px-3 py-1.5 text-[11px] tracking-wider uppercase transition-colors',
    isActive ? 'text-ink' : 'text-muted hover:text-ink',
    isActive
      ? 'after:bg-signal after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:content-[""]'
      : '',
  ].join(' ');

export function Navbar(): React.JSX.Element {
  const { user, allowed, signOut } = useAuth();

  // Hiding is a courtesy, not the enforcement point: the API re-checks every
  // request regardless of what the navbar shows, and every route is gated
  // besides.
  const selfService = user !== null && isSelfScoped(user.roles);
  const items = selfService ? selfServiceNav(user.employeeId) : NAV;
  const visible = items.filter((item) => allowed(...item.permission));

  // An HR Manager has no payroll access at all (rule R3), so the Payroll menu
  // is hidden from them entirely -- and with it the way to their own payslip,
  // which is nobody's idea of a payroll permission. They get a direct link
  // instead. Employees already have one in their own menu.
  const showOwnPayslips =
    !selfService &&
    !allowed('read', 'payslip') &&
    allowed('readSelf', 'payslip');

  return (
    <header className="border-steel-300 brushed sticky top-0 z-20 border-b">
      <nav className="flex h-16 items-center gap-1 px-5">
        <NavLink to="/employees" className="mr-6 flex items-center gap-2.5">
          <Logo size={30} withWordmark />
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
                className="font-mono text-muted hover:text-ink px-3 py-1.5 text-[11px] tracking-wider uppercase transition-colors"
              >
                {item.label} <span aria-hidden="true">&#9662;</span>
              </button>
              <div className="border-steel-300 bg-raised invisible absolute left-0 z-30 mt-2 min-w-48 rounded-sm border py-1 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {item.children
                  .filter((child) => allowed(...child.permission))
                  .map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) =>
                        [
                          'font-mono block px-3 py-2 text-[11px] tracking-wider uppercase',
                          isActive
                            ? 'bg-steel-100 text-ink border-signal border-l-2'
                            : 'text-muted hover:bg-steel-100 hover:text-ink border-l-2 border-transparent',
                        ].join(' ')
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
          {showOwnPayslips && (
            <NavLink
              to="/payroll/payslips"
              className={({ isActive }) => linkClass(isActive)}
              title="Your own payslips"
            >
              My Payslips
            </NavLink>
          )}
          {allowed('read', 'user') && (
            <NavLink
              to="/admin/users"
              className={({ isActive }) => linkClass(isActive)}
              title="User management"
            >
              Users
            </NavLink>
          )}
          <AttendanceWidget />
          <div className="border-steel-300 border-l pl-3 text-right leading-tight">
            <div className="text-xs font-medium">
              {user?.employeeName ?? user?.email}
            </div>
            <div className="eyebrow mt-0.5">
              {user?.departmentName ?? user?.roles[0]?.replace(/_/g, ' ')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void signOut();
            }}
            className="border-steel-300 hover:bg-steel-100 font-mono rounded-sm border px-3 py-1.5 text-[11px] tracking-wider uppercase"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
