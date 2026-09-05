import type { SalaryStructureRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useSalaryStructures } from '../../api/salaryConfig.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function SalaryStructuresListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const structuresQuery = useSalaryStructures({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
  });

  const rows = structuresQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<SalaryStructureRow>[]>(
    () => [
      { id: 'name', header: 'Structure Name', accessorKey: 'name' },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.code}</span>
        ),
      },
      {
        id: 'ruleCount',
        header: 'Rules',
        accessorKey: 'ruleCount',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.ruleCount}</span>
        ),
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
        id: 'active',
        header: 'Active',
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
        title="Salary Structures"
        actions={
          allowed('create', 'salaryStructure') ? (
            <Button
              onClick={() => {
                void navigate('/payroll/structures/new');
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
          placeholder="Search structures…"
          className="max-w-64"
          aria-label="Search salary structures"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={structuresQuery.isLoading}
        isError={structuresQuery.isError}
        errorMessage="Could not load salary structures. The API may still be starting up."
        emptyTitle="No salary structures found"
        emptyDescription="Try a different search, or add a new structure."
        onRowClick={(row) => {
          void navigate(`/payroll/structures/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {structuresQuery.data !== undefined && (
        <Pagination
          page={structuresQuery.data.page}
          pageSize={structuresQuery.data.pageSize}
          total={structuresQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
