import type { EmployeeRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useDepartments } from '../../api/departments.js';
import { useEmployees } from '../../api/employees.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';
import { cn, initialsFrom } from '../../lib/utils.js';

type ViewMode = 'kanban' | 'list';

const LIST_PAGE_SIZE = 20;
const KANBAN_PAGE_SIZE = 100;

export function EmployeesListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  const departmentsQuery = useDepartments({ pageSize: 200 });
  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data?.rows ?? []).map((department) => ({
        value: department.id,
        label: department.name,
      })),
    [departmentsQuery.data],
  );

  const employeesQuery = useEmployees({
    page,
    pageSize: view === 'kanban' ? KANBAN_PAGE_SIZE : LIST_PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
    departmentId: departmentId === '' ? undefined : departmentId,
  });

  const rows = employeesQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        accessorFn: (row) => row.fullName,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="bg-info-soft text-info flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {row.original.initials}
            </span>
            <span className="font-medium">{row.original.fullName}</span>
          </div>
        ),
      },
      {
        id: 'workEmail',
        header: 'Work Email',
        accessorKey: 'workEmail',
        cell: ({ row }) => (
          <span className="text-muted">{row.original.workEmail}</span>
        ),
      },
      {
        id: 'jobPosition',
        header: 'Job Position',
        accessorFn: (row) => row.jobPositionTitle ?? '—',
      },
      {
        id: 'department',
        header: 'Department',
        accessorFn: (row) => row.departmentName ?? '—',
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => (row.active ? 'ACTIVE' : 'INACTIVE'),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.active ? 'ACTIVE' : 'INACTIVE'}
            dot
          />
        ),
      },
    ],
    [],
  );

  const kanbanGroups = useMemo(() => {
    const groups = new Map<string, EmployeeRow[]>();
    for (const employee of rows) {
      const key = employee.departmentName ?? 'Unassigned';
      const bucket = groups.get(key);
      if (bucket === undefined) {
        groups.set(key, [employee]);
      } else {
        bucket.push(employee);
      }
    }
    return Array.from(groups.entries());
  }, [rows]);

  const changeView = (next: ViewMode): void => {
    setView(next);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle="Everyone in the organisation, by department."
        actions={
          allowed('create', 'employee') ? (
            <Button
              onClick={() => {
                void navigate('/employees/new');
              }}
            >
              New
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by name or email…"
          className="max-w-64"
          aria-label="Search employees"
        />
        <Select
          value={departmentId}
          onChange={(event) => {
            setDepartmentId(event.target.value);
            setPage(1);
          }}
          options={departmentOptions}
          placeholder="All departments"
          className="max-w-56"
          aria-label="Filter by department"
        />

        <div className="border-line ml-auto flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => {
              changeView('kanban');
            }}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              view === 'kanban'
                ? 'bg-metal-900 text-white'
                : 'hover:bg-line/60',
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => {
              changeView('list');
            }}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              view === 'list' ? 'bg-metal-900 text-white' : 'hover:bg-line/60',
            )}
          >
            List
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <>
          <DataTable
            columns={columns}
            data={rows}
            isLoading={employeesQuery.isLoading}
            isError={employeesQuery.isError}
            errorMessage="Could not load employees. The API may still be starting up."
            emptyTitle="No employees found"
            emptyDescription="Try a different search or department filter."
            onRowClick={(row) => {
              void navigate(`/employees/${row.id}`);
            }}
          />
          {employeesQuery.data !== undefined && (
            <Pagination
              page={employeesQuery.data.page}
              pageSize={employeesQuery.data.pageSize}
              total={employeesQuery.data.total}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        <KanbanBoard
          groups={kanbanGroups}
          isLoading={employeesQuery.isLoading}
          isError={employeesQuery.isError}
        />
      )}
    </div>
  );
}

function KanbanBoard({
  groups,
  isLoading,
  isError,
}: {
  groups: [string, EmployeeRow[]][];
  isLoading: boolean;
  isError: boolean;
}): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="border-line bg-raised h-64 w-64 shrink-0 animate-pulse rounded-lg border"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-line bg-raised rounded-lg border px-4 py-10 text-center">
        <p className="text-danger text-sm font-medium">
          Could not load employees. The API may still be starting up.
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="border-line bg-raised rounded-lg border px-4 py-10 text-center">
        <p className="text-sm font-medium">No employees found</p>
        <p className="text-muted mt-1 text-xs">
          Try a different search or department filter.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {groups.map(([department, employees]) => (
        <div key={department} className="w-64 shrink-0">
          <div className="text-muted mb-2 flex items-center justify-between px-1 text-xs font-semibold tracking-wide uppercase">
            <span>{department}</span>
            <span className="font-mono">{employees.length}</span>
          </div>
          <div className="space-y-2">
            {employees.map((employee) => (
              <Link
                key={employee.id}
                to={`/employees/${employee.id}`}
                className="border-line bg-raised hover:border-metal-500 block rounded-md border p-3 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="bg-info-soft text-info flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {employee.initials || initialsFrom(employee.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {employee.fullName}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {employee.jobPositionTitle ?? 'No position'} •{' '}
                      {employee.departmentName ?? 'Unassigned'}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    title={employee.active ? 'Active' : 'Inactive'}
                    className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      employee.active ? 'bg-success' : 'bg-neutral',
                    )}
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
