import type { APPROVAL_LEVELS, TimeOffTypeRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTimeOffTypes } from '../../api/timeoff.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

const APPROVAL_LABELS: Record<(typeof APPROVAL_LEVELS)[number], string> = {
  NONE: 'No Validation',
  MANAGER: 'Manager',
  OFFICER: 'HR Officer',
};

export function TimeOffTypesListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const typesQuery = useTimeOffTypes({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
  });

  const rows = typesQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<TimeOffTypeRow>[]>(
    () => [
      { id: 'name', header: 'Type', accessorKey: 'name' },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.code}</span>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        accessorFn: (row) => (row.unit === 'DAYS' ? 'Days' : 'Hours'),
      },
      {
        id: 'allocation',
        header: 'Allocation',
        accessorFn: (row) => (row.requiresAllocation ? 'Required' : 'Not Required'),
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.requiresAllocation ? 'Required' : 'Not Required'}
            tone={row.original.requiresAllocation ? 'info' : 'neutral'}
          />
        ),
      },
      {
        id: 'approvalLevel',
        header: 'Approval',
        accessorFn: (row) => APPROVAL_LABELS[row.approvalLevel],
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => (row.active ? 'ACTIVE' : 'INACTIVE'),
        cell: ({ row }) => (
          <StatusBadge status={row.original.active ? 'ACTIVE' : 'INACTIVE'} dot />
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Time Off Types"
        actions={
          allowed('create', 'timeOffType') ? (
            <Button
              onClick={() => {
                void navigate('/time-off/types/new');
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
          placeholder="Search time off types…"
          className="max-w-64"
          aria-label="Search time off types"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={typesQuery.isLoading}
        isError={typesQuery.isError}
        errorMessage="Could not load time off types. The API may still be starting up."
        emptyTitle="No time off types found"
        emptyDescription="Try a different search, or add a new type."
        onRowClick={(row) => {
          void navigate(`/time-off/types/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {typesQuery.data !== undefined && (
        <Pagination
          page={typesQuery.data.page}
          pageSize={typesQuery.data.pageSize}
          total={typesQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
