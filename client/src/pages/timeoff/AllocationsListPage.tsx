import { type AllocationRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useApproveAllocation,
  useAllocations,
  useRefuseAllocation,
} from '../../api/timeoff.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

function formatQty(value: number, unit: AllocationRow['unit']): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit === 'DAYS' ? 'd' : 'h'}`;
}

export function AllocationsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);

  const allocationsQuery = useAllocations({ page, pageSize: PAGE_SIZE });
  const approveMutation = useApproveAllocation();
  const refuseMutation = useRefuseAllocation();

  const rows = allocationsQuery.data?.rows ?? [];
  const canApprove = allowed('update', 'timeOffAllocation');

  const columns = useMemo<ColumnDef<AllocationRow>[]>(
    () => [
      { id: 'employee', header: 'Employee', accessorKey: 'employeeName' },
      { id: 'type', header: 'Type', accessorKey: 'typeName' },
      {
        id: 'allocated',
        header: 'Allocated',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatQty(row.original.allocatedQty, row.original.unit)}
          </span>
        ),
      },
      {
        id: 'taken',
        header: 'Taken',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatQty(row.original.takenQty, row.original.unit)}
          </span>
        ),
      },
      {
        id: 'remaining',
        header: 'Remaining',
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatQty(row.original.remainingQty, row.original.unit)}
          </span>
        ),
      },
      {
        id: 'validity',
        header: 'Valid',
        accessorFn: (row) =>
          `${row.validFrom.slice(0, 10)} → ${row.validTo !== null ? row.validTo.slice(0, 10) : '—'}`,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canApprove && row.original.status === 'TO_APPROVE' ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                className="text-success"
                onClick={(event) => {
                  event.stopPropagation();
                  approveMutation.mutate(row.original.id);
                }}
                disabled={approveMutation.isPending}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-danger"
                onClick={(event) => {
                  event.stopPropagation();
                  refuseMutation.mutate(row.original.id);
                }}
                disabled={refuseMutation.isPending}
              >
                Refuse
              </Button>
            </div>
          ) : null,
      },
    ],
    [canApprove, approveMutation, refuseMutation],
  );

  return (
    <div>
      <PageHeader
        title="Allocations"
        actions={
          allowed('create', 'timeOffAllocation') ? (
            <Button
              onClick={() => {
                void navigate('/time-off/allocations/new');
              }}
            >
              New
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={allocationsQuery.isLoading}
        isError={allocationsQuery.isError}
        errorMessage="Could not load allocations. The API may still be starting up."
        emptyTitle="No allocations found"
        emptyDescription="Grant an employee some leave to get started."
        onRowClick={(row) => {
          void navigate(`/time-off/allocations/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {allocationsQuery.data !== undefined && (
        <Pagination
          page={allocationsQuery.data.page}
          pageSize={allocationsQuery.data.pageSize}
          total={allocationsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
