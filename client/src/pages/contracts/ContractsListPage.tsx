import { formatINR, type ContractRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useContracts } from '../../api/contracts.js';
import { useEmployee } from '../../api/employees.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function ContractsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeId = searchParams.get('employeeId') ?? undefined;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const employeeQuery = useEmployee(employeeId);

  const contractsQuery = useContracts({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
    employeeId,
  });

  const rows = contractsQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<ContractRow>[]>(
    () => [
      {
        id: 'reference',
        header: 'Contract',
        accessorKey: 'reference',
        cell: ({ row }) => (
          <span
            className={
              row.original.status === 'RUNNING' ? 'font-semibold' : undefined
            }
          >
            {row.original.reference}
          </span>
        ),
      },
      {
        id: 'employee',
        header: 'Employee',
        accessorKey: 'employeeName',
      },
      {
        id: 'startDate',
        header: 'Start',
        accessorFn: (row) => row.startDate.slice(0, 10),
      },
      {
        id: 'endDate',
        header: 'End',
        accessorFn: (row) =>
          row.endDate !== null ? row.endDate.slice(0, 10) : '—',
      },
      {
        id: 'wageMonthly',
        header: 'Wage / Month',
        accessorKey: 'wageMonthly',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatINR(row.original.wageMonthly)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            dot={row.original.status === 'RUNNING'}
          />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Contracts"
        breadcrumbs={
          employeeId !== undefined
            ? [
                { label: 'Employees', to: '/employees' },
                {
                  label: employeeQuery.data?.fullName ?? 'Employee',
                  to: `/employees/${employeeId}`,
                },
                { label: 'Contracts' },
              ]
            : undefined
        }
        subtitle={
          employeeId !== undefined
            ? `Filtered to ${employeeQuery.data?.fullName ?? 'this employee'}.`
            : undefined
        }
        actions={
          allowed('create', 'contract') ? (
            <Button
              onClick={() => {
                void navigate(
                  employeeId !== undefined
                    ? `/contracts/new?employeeId=${employeeId}`
                    : '/contracts/new',
                );
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
          placeholder="Search by reference or employee…"
          className="max-w-64"
          aria-label="Search contracts"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={contractsQuery.isLoading}
        isError={contractsQuery.isError}
        errorMessage="Could not load contracts. The API may still be starting up."
        emptyTitle="No contracts found"
        emptyDescription={
          employeeId !== undefined
            ? 'This employee has no contracts yet.'
            : 'Try a different search, or add a new contract.'
        }
        onRowClick={(row) => {
          void navigate(`/contracts/${row.id}`);
        }}
        getRowId={(row) => row.id}
        rowClassName={(row) =>
          row.status === 'RUNNING'
            ? 'bg-success-soft/50 border-l-4 border-l-success'
            : undefined
        }
      />
      {contractsQuery.data !== undefined && (
        <Pagination
          page={contractsQuery.data.page}
          pageSize={contractsQuery.data.pageSize}
          total={contractsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
