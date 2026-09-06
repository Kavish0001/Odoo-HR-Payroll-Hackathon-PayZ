import { formatINR, type PayrunRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDeletePayrun, usePayruns } from '../../api/payruns.js';
import { DataTable } from '../../components/data/DataTable.js';
import { DeleteRowButton } from '../../components/data/DeleteRowButton.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function PayrunsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  // ADMIN only, and the API refuses a validated or paid run outright: that
  // is payroll history somebody was paid against (rule 10). The icon says so
  // rather than offering a click that comes back 409.
  const canDelete = allowed('delete', 'payrun');
  const deleteMutation = useDeletePayrun();

  const payrunsQuery = usePayruns({ page, pageSize: PAGE_SIZE });
  const rows = payrunsQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<PayrunRow>[]>(
    () => [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      {
        id: 'period',
        header: 'Period',
        cell: ({ row }) => (
          <span>
            {row.original.periodStart.slice(0, 10)} –{' '}
            {row.original.periodEnd.slice(0, 10)}
          </span>
        ),
      },
      { id: 'structure', header: 'Structure', accessorKey: 'structureName' },
      {
        id: 'employees',
        header: 'Employees',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.employeeCount}</span>
        ),
      },
      {
        id: 'warnings',
        header: 'Warnings',
        cell: ({ row }) =>
          row.original.warningCount === 0 ? (
            <span className="text-muted">—</span>
          ) : (
            <span
              className={
                row.original.blockingWarningCount > 0
                  ? 'font-mono text-danger'
                  : 'font-mono text-warning'
              }
            >
              {row.original.warningCount}
            </span>
          ),
      },
      {
        id: 'totalNet',
        header: 'Net Total',
        cell: ({ row }) => (
          <span className="font-mono">{formatINR(row.original.totalNet)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      ...(canDelete
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => {
                const finalised =
                  row.original.status === 'VALIDATED' ||
                  row.original.status === 'PAID';
                return (
                  <DeleteRowButton
                    label={row.original.name}
                    isPending={deleteMutation.isPending}
                    disabledReason={
                      finalised
                        ? 'Validated and paid payruns are payroll history. Cancel it instead.'
                        : undefined
                    }
                    onConfirm={() => {
                      deleteMutation.mutate(row.original.id);
                    }}
                  />
                );
              },
            } satisfies ColumnDef<PayrunRow>,
          ]
        : []),
    ],
    [canDelete, deleteMutation],
  );

  return (
    <div>
      <PageHeader
        title="Payruns"
        subtitle="Run payroll for a period, from selection through Compute, Validate, Mark Paid and Send Payslips."
        actions={
          allowed('create', 'payrun') ? (
            <Button
              onClick={() => {
                void navigate('/payroll/payruns/new');
              }}
            >
              New Payrun
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={payrunsQuery.isLoading}
        isError={payrunsQuery.isError}
        errorMessage="Could not load payruns. The API may still be starting up."
        emptyTitle="No payruns yet"
        emptyDescription="Start one from the New Payrun wizard."
        onRowClick={(row) => {
          void navigate(`/payroll/payruns/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {payrunsQuery.data !== undefined && (
        <Pagination
          page={payrunsQuery.data.page}
          pageSize={payrunsQuery.data.pageSize}
          total={payrunsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
