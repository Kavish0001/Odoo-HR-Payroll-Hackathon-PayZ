import { TIME_OFF_STATUSES, type TimeOffRequestRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useEmployees } from '../../api/employees.js';
import {
  useApproveTimeOffRequest,
  useRefuseTimeOffRequest,
  useTimeOffRequests,
  useTimeOffTypes,
} from '../../api/timeoff.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  TO_APPROVE: 'To approve',
  APPROVED: 'Approved',
  REFUSED: 'Refused',
  CANCELLED: 'Cancelled',
};

const STATUS_OPTIONS = TIME_OFF_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value] ?? value,
}));

export function TimeOffRequestsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);

  // Filters live in the URL, so a filtered queue survives a reload and can be
  // handed to somebody as a link -- the same thing the attendance list does.
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const typeId = searchParams.get('typeId') ?? '';
  const employeeId = searchParams.get('employeeId') ?? '';

  const setFilter = (key: string, value: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
    setPage(1);
  };

  // 'approve' is the right question for the employee filter too: a self-scoped
  // caller only ever receives their own rows, so a picker of colleagues would
  // be both empty and pointless for them.
  const canApprove = allowed('approve', 'timeOffRequest');

  const typesQuery = useTimeOffTypes({ pageSize: 200, active: 'true' });
  const employeesQuery = useEmployees({ pageSize: 200 }, canApprove);

  const requestsQuery = useTimeOffRequests({
    page,
    pageSize: PAGE_SIZE,
    ...(status === '' ? {} : { status }),
    ...(typeId === '' ? {} : { typeId }),
    ...(employeeId === '' ? {} : { employeeId }),
  });
  const approveMutation = useApproveTimeOffRequest();
  const refuseMutation = useRefuseTimeOffRequest();

  const typeOptions = (typesQuery.data?.rows ?? []).map((t) => ({
    value: t.id,
    label: t.name,
  }));
  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));
  const hasFilters = status !== '' || typeId !== '' || employeeId !== '';

  const rows = requestsQuery.data?.rows ?? [];

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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Button
          type="button"
          size="sm"
          variant={status === 'TO_APPROVE' ? 'primary' : 'secondary'}
          onClick={() => {
            setFilter('status', status === 'TO_APPROVE' ? '' : 'TO_APPROVE');
          }}
        >
          Awaiting approval
        </Button>

        <Select
          aria-label="Filter by status"
          className="max-w-44"
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={status}
          onChange={(event) => {
            setFilter('status', event.target.value);
          }}
        />

        <Select
          aria-label="Filter by time off type"
          className="max-w-48"
          options={typeOptions}
          placeholder="All types"
          value={typeId}
          onChange={(event) => {
            setFilter('typeId', event.target.value);
          }}
        />

        {canApprove && (
          <Select
            aria-label="Filter by employee"
            className="max-w-56"
            options={employeeOptions}
            placeholder="All employees"
            value={employeeId}
            onChange={(event) => {
              setFilter('employeeId', event.target.value);
            }}
          />
        )}

        {hasFilters && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setSearchParams(new URLSearchParams());
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}

        {requestsQuery.data !== undefined && (
          <p className="text-muted ml-auto font-mono text-xs">
            {requestsQuery.data.total} request
            {requestsQuery.data.total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={requestsQuery.isLoading}
        isError={requestsQuery.isError}
        errorMessage="Could not load time off requests. The API may still be starting up."
        emptyTitle="No time off requests found"
        emptyDescription={
          hasFilters
            ? 'Nothing matches these filters. Clear them to see everything.'
            : 'Submit a new request to get started.'
        }
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
