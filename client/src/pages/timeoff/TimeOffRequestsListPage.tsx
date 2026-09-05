import { type TimeOffRequestRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useApproveTimeOffRequest,
  useRefuseTimeOffRequest,
  useTimeOffRequests,
} from '../../api/timeoff.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function TimeOffRequestsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);

  const requestsQuery = useTimeOffRequests({ page, pageSize: PAGE_SIZE });
  const approveMutation = useApproveTimeOffRequest();
  const refuseMutation = useRefuseTimeOffRequest();

  const rows = requestsQuery.data?.rows ?? [];
  // 'approve', not 'update': an employee holds update so they can edit their
  // own pending request, and showing them Approve/Refuse on a colleague's row
  // offered a decision that is not theirs to make (rule T8).
  const canApprove = allowed('approve', 'timeOffRequest');

  const columns = useMemo<ColumnDef<TimeOffRequestRow>[]>(
    () => [
      { id: 'employee', header: 'Employee', accessorKey: 'employeeName' },
      { id: 'type', header: 'Type', accessorKey: 'typeName' },
      {
        id: 'startDate',
        header: 'Start',
        accessorFn: (row) => row.startDate.slice(0, 10),
      },
      {
        id: 'endDate',
        header: 'End',
        accessorFn: (row) => row.endDate.slice(0, 10),
      },
      {
        id: 'duration',
        header: 'Duration',
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.duration} {row.original.unit === 'DAYS' ? 'd' : 'h'}
          </span>
        ),
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
        title="Time Off"
        actions={
          allowed('create', 'timeOffRequest') ? (
            <Button
              onClick={() => {
                void navigate('/time-off/requests/new');
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
        isLoading={requestsQuery.isLoading}
        isError={requestsQuery.isError}
        errorMessage="Could not load time off requests. The API may still be starting up."
        emptyTitle="No time off requests found"
        emptyDescription="Submit a new request to get started."
        onRowClick={(row) => {
          void navigate(`/time-off/requests/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {requestsQuery.data !== undefined && (
        <Pagination
          page={requestsQuery.data.page}
          pageSize={requestsQuery.data.pageSize}
          total={requestsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
