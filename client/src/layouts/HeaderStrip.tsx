import { useLocation } from 'react-router-dom';

/**
 * The dotted-grid strip beneath the navbar, with the current path as a
 * monospace breadcrumb and an abstract node diagram floating at the right.
 *
 * The diagram is the same idea as the landing hero: employee, attendance,
 * payroll, payslip as connected nodes. Here it is decoration only, drawn
 * faintly enough to read as texture rather than content.
 */

const LABELS: Record<string, string> = {
  employees: 'EMPLOYEES',
  contracts: 'CONTRACTS',
  attendance: 'ATTENDANCE',
  departments: 'DEPARTMENTS',
  'working-schedules': 'SCHEDULES',
  'time-off': 'TIME OFF',
  requests: 'REQUESTS',
  allocations: 'ALLOCATIONS',
  types: 'TYPES',
  payroll: 'PAYROLL',
  payruns: 'PAYRUNS',
  payslips: 'PAYSLIPS',
  structures: 'STRUCTURES',
  rules: 'RULES',
  dashboard: 'DASHBOARD',
  admin: 'ADMIN',
  users: 'USERS',
  new: 'NEW',
};

function crumbsFor(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map(
    (part) =>
      LABELS[part] ??
      // A cuid segment is a record id, not a section name.
      (/^c[a-z0-9]{20,}$/.test(part) ? 'DETAIL' : part.toUpperCase()),
  );
}

export function HeaderStrip(): React.JSX.Element {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);

  return (
    <div className="border-steel-300 brushed dot-grid relative h-14 overflow-hidden border-b">
      <div className="flex h-full items-center px-5">
        <nav className="eyebrow flex items-center gap-2">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${String(index)}`} className="flex gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              <span className={index === crumbs.length - 1 ? 'text-ink' : ''}>
                {crumb}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <svg
        aria-hidden="true"
        viewBox="0 0 320 56"
        className="text-steel-300 pointer-events-none absolute top-0 right-0 h-full w-80 opacity-70"
        fill="none"
      >
        <path
          d="M8 40 L64 16 L128 40 L192 16 L256 40 L312 20"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M128 40 L128 8 M192 16 L192 48"
          stroke="currentColor"
          strokeWidth="1"
        />
        <polygon
          points="192,4 204,16 192,28 180,16"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle
          cx="64"
          cy="16"
          r="5"
          fill="var(--color-steel-50)"
          stroke="currentColor"
        />
        <circle
          cx="128"
          cy="40"
          r="5"
          fill="var(--color-steel-50)"
          stroke="currentColor"
        />
        <circle
          cx="256"
          cy="40"
          r="5"
          fill="var(--color-steel-50)"
          stroke="currentColor"
        />
        <circle
          cx="312"
          cy="20"
          r="4"
          fill="var(--color-steel-50)"
          stroke="currentColor"
        />
      </svg>
    </div>
  );
}
