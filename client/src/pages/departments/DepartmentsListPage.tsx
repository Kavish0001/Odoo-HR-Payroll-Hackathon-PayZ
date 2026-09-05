import type { DepartmentRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDepartments } from '../../api/departments.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function DepartmentsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const departmentsQuery = useDepartments({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
  });

  const rows = departmentsQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<DepartmentRow>[]>(
    () => [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      {
        id: 'code',
        header: 'Code',
        accessorFn: (row) => row.code ?? '—',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.code ?? '—'}</span>
        ),
      },
      {
        id: 'manager',
        header: 'Manager',
        accessorFn: (row) => row.managerName ?? '—',
      },
      {
        id: 'employeeCount',
        header: 'Employees',
        accessorKey: 'employeeCount',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.employeeCount}</span>
        ),
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

  return (
    <div>
      <PageHeader
        title="Departments"
        actions={
          allowed('create', 'department') ? (
            <Button
              onClick={() => {
                void navigate('/departments/new');
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
          placeholder="Search departments…"
          className="max-w-64"
          aria-label="Search departments"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={departmentsQuery.isLoading}
        isError={departmentsQuery.isError}
        errorMessage="Could not load departments. The API may still be starting up."
        emptyTitle="No departments found"
        emptyDescription="Try a different search, or add a new department."
        onRowClick={(row) => {
          void navigate(`/departments/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {departmentsQuery.data !== undefined && (
        <Pagination
          page={departmentsQuery.data.page}
          pageSize={departmentsQuery.data.pageSize}
          total={departmentsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
