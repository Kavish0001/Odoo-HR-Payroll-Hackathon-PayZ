import { ROLES, ROLE_LABELS, type Role } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useEmployees } from '../../api/employees.js';
import {
  useCreateUser,
  useDeactivateUser,
  useUpdateUser,
  useUser,
} from '../../api/users.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

/** What each role unlocks, so assigning one is an informed choice. */
const ROLE_HELP: Record<Role, string> = {
  EMPLOYEE: 'Own profile, own attendance and own leave balance only.',
  HR_MANAGER: 'Full HR master data and leave approvals. No payroll at all.',
  HR_PAYROLL_USER:
    'HR, plus payruns and payslips. Salary structures and rules are read-only.',
  HR_PAYROLL_MANAGER: 'Full payroll, including salary structures and rules.',
  ADMIN: 'Everything, plus user management and role assignment.',
};

export function UserFormPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const isNew = id === 'new';
  const userQuery = useUser(id);
  const employeesQuery = useEmployees({ pageSize: 200 });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser(id ?? '');
  const deactivate = useDeactivateUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [roles, setRoles] = useState<Role[]>(['EMPLOYEE']);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const existing = userQuery.data;
  useEffect(() => {
    if (existing === undefined) {
      return;
    }
    setEmail(existing.email);
    setEmployeeId(existing.employeeId ?? '');
    setRoles(existing.roles);
    setActive(existing.status === 'ACTIVE');
  }, [existing]);

  // Rule R5, mirrored from the server. The API refuses this regardless of what
  // the form allows, so this only spares the admin a pointless round trip.
  const isSelf = !isNew && existing?.id === currentUser?.id;

  const toggleRole = (role: Role): void => {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((value) => value !== role)
        : [...current, role],
    );
  };

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      if (isNew) {
        const created = await createUser.mutateAsync({
          email,
          password,
          roles,
          status: active ? 'ACTIVE' : 'INACTIVE',
          employeeId: employeeId === '' ? null : employeeId,
        });
        void navigate(`/admin/users/${created.id}`);
        return;
      }

      await updateUser.mutateAsync({
        email,
        employeeId: employeeId === '' ? null : employeeId,
        ...(password.length > 0 ? { password } : {}),
        ...(isSelf ? {} : { roles, status: active ? 'ACTIVE' : 'INACTIVE' }),
      });
      setPassword('');
      void navigate('/admin/users');
    } catch (cause) {
      setError(toApiError(cause).message);
    }
  };

  const employeeOptions = [
    { value: '', label: 'Not linked to an employee' },
    ...(employeesQuery.data?.rows ?? []).map((employee) => ({
      value: employee.id,
      label: `${employee.fullName} — ${employee.departmentName ?? 'No department'}`,
    })),
  ];

  return (
    <FormShell
      header={
        <PageHeader
          title={isNew ? 'Create User' : (existing?.email ?? 'User')}
          breadcrumbs={[{ label: 'User Management', to: '/admin/users' }]}
          subtitle="Roles decide which modules this person sees after signing in."
        />
      }
      isSubmitting={createUser.isPending || updateUser.isPending}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onDiscard={() => {
        void navigate('/admin/users');
      }}
      saveLabel={isNew ? 'Create User' : 'Save Access'}
      disableSave={roles.length === 0}
      error={error}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Work Email" required>
          <Input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="name@company.com"
          />
        </Field>

        <Field
          label={isNew ? 'Password' : 'New Password'}
          required={isNew}
          hint={
            isNew
              ? 'At least 12 characters.'
              : 'Leave blank to keep the current password. Changing it signs the user out everywhere.'
          }
        >
          <Input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            placeholder={isNew ? 'At least 12 characters' : '••••••••••'}
            className="font-mono"
          />
        </Field>

        <Field
          label="Employee"
          hint="Linking an account to an employee is what gives it ownership of records. An unlinked account cannot use the Employee role."
        >
          <Select
            value={employeeId}
            onChange={(event) => {
              setEmployeeId(event.target.value);
            }}
            options={employeeOptions}
          />
        </Field>

        <Field label="Account Status">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={active}
              disabled={isSelf}
              onChange={(event) => {
                setActive(event.target.checked);
              }}
            />
            {active ? 'Active' : 'Inactive'}
          </label>
        </Field>
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide uppercase">Roles</h2>
          {isSelf && (
            <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 text-xs font-medium">
              You cannot change your own access
            </span>
          )}
        </div>

        <div className="space-y-2">
          {ROLES.map((role) => (
            <label
              key={role}
              className={`border-line flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                roles.includes(role) ? 'bg-info-soft/40' : ''
              } ${isSelf ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={roles.includes(role)}
                disabled={isSelf}
                onChange={() => {
                  toggleRole(role);
                }}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-muted block text-xs">
                  {ROLE_HELP[role]}
                </span>
              </span>
            </label>
          ))}
        </div>

        {roles.length === 0 && (
          <p className="text-danger mt-2 text-xs">
            Assign at least one role, or the account can sign in and see
            nothing.
          </p>
        )}
      </Card>

      {!isNew && !isSelf && existing?.status === 'ACTIVE' && (
        <div className="border-danger-line bg-danger-soft/40 mt-4 flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Deactivate this account</div>
            <div className="text-muted text-xs">
              The person can no longer sign in, and any session they hold is
              invalidated immediately. The record is kept, never deleted.
            </div>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              void (async () => {
                setError(null);
                try {
                  await deactivate.mutateAsync(id ?? '');
                  void navigate('/admin/users');
                } catch (cause) {
                  setError(toApiError(cause).message);
                }
              })();
            }}
          >
            Deactivate
          </Button>
        </div>
      )}
    </FormShell>
  );
}
