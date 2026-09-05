import { ROLES, ROLE_LABELS, type Role } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUsers, type UserRow } from '../../api/users.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

const ROLE_OPTIONS = ROLES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

/** Higher roles read as more consequential, so they carry more weight. */
const ROLE_TONE: Record<Role, string> = {
  EMPLOYEE: 'bg-neutral-soft text-neutral',
  HR_MANAGER: 'bg-info-soft text-info',
  HR_PAYROLL_USER: 'bg-teal-soft text-teal',
  HR_PAYROLL_MANAGER: 'bg-accent-soft text-accent',
  ADMIN: 'bg-danger-soft text-danger',
};

function RoleChips({ roles }: { roles: Role[] }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span
          key={role}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_TONE[role]}`}
        >
          {ROLE_LABELS[role]}
        </span>
      ))}
    </div>
  );
}

export function UsersListPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { allowed, user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [page, setPage] = useState(1);

  const query = useUsers({
    page,
    ...(search.length > 0 ? { search } : {}),
    ...(role !== '' ? { role } : {}),
  });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        header: 'User',
        accessorKey: 'email',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.employeeName ?? row.original.email}
              {row.original.id === currentUser?.id && (
                <span className="text-muted ml-2 text-xs">(you)</span>
              )}
            </div>
            {row.original.employeeName !== null && (
              <div className="text-muted font-mono text-xs">
                {row.original.email}
              </div>
            )}
          </div>
        ),
      },
      {
        header: 'Employee',
        accessorKey: 'employeeName',
        cell: ({ row }) =>
          row.original.employeeName === null ? (
            // An account with no employee owns no records, so the EMPLOYEE
            // role's own-records scoping has nothing to resolve.
            <span className="text-muted text-xs">Not linked</span>
          ) : (
            <span>{row.original.departmentName ?? '—'}</span>
          ),
      },
      {
        header: 'Roles',
        accessorKey: 'roles',
        cell: ({ row }) => <RoleChips roles={row.original.roles} />,
      },
      {
        header: 'Last Sign In',
        accessorKey: 'lastLoginAt',
        cell: ({ row }) => (
          <span className="text-muted font-mono text-xs">
            {row.original.lastLoginAt === null
              ? 'Never'
              : new Date(row.original.lastLoginAt).toLocaleDateString('en-IN')}
          </span>
        ),
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} dot />,
      },
    ],
    [currentUser?.id],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="User Management"
        subtitle="Accounts are created here and linked to an employee record. Roles decide which modules a person sees after signing in."
        actions={
          allowed('create', 'user') ? (
            <Button
              onClick={() => {
                void navigate('/admin/users/new');
              }}
            >
              + New User
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search users, employees or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={role}
          onChange={(event) => {
            setRole(event.target.value as Role | '');
            setPage(1);
          }}
          className="max-w-48"
          options={[{ value: '', label: 'All roles' }, ...ROLE_OPTIONS]}
        />
      </div>

      <DataTable
        columns={columns}
        data={query.data?.rows ?? []}
        isLoading={query.isLoading}
        emptyTitle="No user accounts"
        emptyDescription="No accounts match these filters. Accounts are created by an administrator and linked to an employee."
        onRowClick={(row) => {
          void navigate(`/admin/users/${row.id}`);
        }}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
