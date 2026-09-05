import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  useJobPositions,
  type JobPositionRow,
} from '../../api/jobPositions.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

/**
 * The job position catalogue — the titles the employee and contract forms
 * pick from. Counts are shown because they are the reason a position cannot
 * simply be deleted: people and contracts still point at it.
 */
export function JobPositionsListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const positionsQuery = useJobPositions({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() === '' ? undefined : search.trim(),
  });

  const rows = positionsQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<JobPositionRow>[]>(
    () => [
      { id: 'title', header: 'Title', accessorKey: 'title' },
      {
        id: 'employeeCount',
        header: 'Employees',
        accessorKey: 'employeeCount',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.employeeCount}</span>
        ),
      },
      {
        id: 'contractCount',
        header: 'Contracts',
        accessorKey: 'contractCount',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.contractCount}</span>
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
        title="Job Positions"
        actions={
          allowed('create', 'jobPosition') ? (
            <Button
              onClick={() => {
                void navigate('/job-positions/new');
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
          placeholder="Search job positions…"
          className="max-w-64"
          aria-label="Search job positions"
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={positionsQuery.isLoading}
        isError={positionsQuery.isError}
        errorMessage="Could not load job positions. The API may still be starting up."
        emptyTitle="No job positions found"
        emptyDescription="Try a different search, or add a new position."
        onRowClick={(row) => {
          void navigate(`/job-positions/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {positionsQuery.data !== undefined && (
        <Pagination
          page={positionsQuery.data.page}
          pageSize={positionsQuery.data.pageSize}
          total={positionsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
