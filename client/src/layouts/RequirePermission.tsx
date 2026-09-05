import { type Action, type Resource } from '@payz/shared';
import { Outlet } from 'react-router-dom';

import { PageHeader } from '../components/data/PageHeader.js';
import { Card } from '../components/ui/Card.js';
import { useAuth } from '../lib/auth.js';

/**
 * A route-level permission gate.
 *
 * The navbar already hides links a role cannot use, but hiding a link is not
 * a control: anyone can type `/admin/users`. Without this, a payroll officer
 * who does reaches the User Management screen, watches every request come
 * back 403, and sees an empty table rather than an answer.
 *
 * Every area in the app is wrapped in one of these, on the same permission
 * the navbar consults, so no path can be reached by typing it that could not
 * be reached by clicking.
 *
 * The API is still the enforcement point — it refuses those requests whatever
 * the browser believes (rule R1). This exists so the refusal is legible.
 */
export function RequirePermission({
  action,
  resource,
  label,
}: {
  action: Action;
  resource: Resource;
  /** How to name the area in the refusal, e.g. "User Management". */
  label: string;
}): React.JSX.Element {
  const { allowed } = useAuth();

  if (allowed(action, resource)) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Not available to your role"
        subtitle={`${label} is not part of what your role covers.`}
      />
      <Card>
        <p className="text-sm">
          Your account does not have permission to open this area.
        </p>
        <p className="text-muted mt-2 text-xs">
          Roles are assigned by an administrator, and nobody — administrators
          included — can change their own. If you need access here, ask an
          administrator to grant it.
        </p>
      </Card>
    </div>
  );
}
