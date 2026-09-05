import type { WorkingScheduleRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useWorkingSchedules } from '../../api/workingSchedules.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function WorkingSchedulesListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const schedulesQuery = useWorkingSchedules({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
  });

  const rows = schedulesQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<WorkingScheduleRow>[]>(
    () => [
      { id: 'name', header: 'Schedule Name', accessorKey: 'name' },
      {
        id: 'daysPerWeek',
        header: 'Days / Week',
        accessorKey: 'daysPerWeek',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.daysPerWeek}</span>
        ),
      },
      {
        id: 'hoursPerWeek',
        header: 'Hours / Week',
        accessorKey: 'hoursPerWeek',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.hoursPerWeek}h</span>
        ),
      },
      // The schema has no multi-company field yet, so "Calendar Type" stands
      // in for the wireframe's "Company" column.
      { id: 'calendarType', header: 'Calendar Type', accessorKey: 'calendarType' },
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
        title="Working Schedules"
        actions={
          allowed('create', 'workingSchedule') ? (
            <Button
              onClick={() => {
                void navigate('/working-schedules/new');
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
          placeholder="Search schedules…"
          className="max-w-64"
          aria-label="Search working schedules"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={schedulesQuery.isLoading}
        isError={schedulesQuery.isError}
        errorMessage="Could not load working schedules. The API may still be starting up."
        emptyTitle="No working schedules found"
        emptyDescription="Try a different search, or add a new schedule."
        onRowClick={(row) => {
          void navigate(`/working-schedules/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {schedulesQuery.data !== undefined && (
        <Pagination
          page={schedulesQuery.data.page}
          pageSize={schedulesQuery.data.pageSize}
          total={schedulesQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
