import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: readonly Crumb[] | undefined;
  subtitle?: string | undefined;
  actions?: ReactNode;
}

/** Title, breadcrumb trail and action buttons, consistent across every screen. */
export function PageHeader({
  title,
  breadcrumbs,
  subtitle,
  actions,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {breadcrumbs !== undefined && breadcrumbs.length > 0 && (
          <nav className="text-muted mb-1 flex items-center gap-1 text-xs">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {index > 0 && <span aria-hidden="true">/</span>}
                {crumb.to !== undefined ? (
                  <Link
                    to={crumb.to}
                    className="hover:text-ink hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle !== undefined && (
          <p className="text-muted mt-0.5 text-sm">{subtitle}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
