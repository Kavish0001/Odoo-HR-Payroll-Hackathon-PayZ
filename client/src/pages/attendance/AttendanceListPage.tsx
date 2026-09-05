import { ATTENDANCE_STATUSES, type AttendanceRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAttendanceRecords } from '../../api/attendance.js';
import { useEmployee, useEmployees } from '../../api/employees.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ATTENDANCE_STATUSES.map((value) => ({
  value,
  label: value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '),
}));

/** `YYYY-MM-DD` for today in the browser's local timezone. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${date}`;
}

function formatDateTime(value: string | null): string {
  if (value === null) {
    return '—';
  }
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AttendanceListPage(): React.JSX.Element {
  const { allowed } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEmployeeId = searchParams.get('employeeId') ?? undefined;

  // The date range lives in the URL so a filtered view can be linked and
  // survives a reload, the way the payroll dashboard keeps its period.
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';

  // Only a manager-and-above caller can browse every employee's attendance —
  // an EMPLOYEE caller is scoped to their own records by the API regardless
  // (rule R2), so the picker would just be dead weight for them.
  const canManage = allowed('update', 'attendance');

  const [employeeFilter, setEmployeeFilter] = useState<string | undefined>(
    undefined,
  );
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  // "Today" is the same range filter with both ends pinned to today, not a
  // second source of truth — otherwise the shortcut and the date inputs could
  // disagree about which range is actually in force.
  const today = todayIso();
  const todayOnly = from === today && to === today;

  const employeeId = urlEmployeeId ?? employeeFilter;

  /** Writes one filter to the URL, dropping it entirely when cleared. */
  const setDateParam = (key: 'from' | 'to', value: string): void => {
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

  const employeeQuery = useEmployee(urlEmployeeId);
  const employeesQuery = useEmployees({ pageSize: 200 });

  const attendanceQuery = useAttendanceRecords({
    page,
    pageSize: PAGE_SIZE,
    employeeId,
    status,
    from: from === '' ? undefined : from,
    to: to === '' ? undefined : to,
  });

  const rows = attendanceQuery.data?.rows ?? [];

  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));

  const columns = useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        id: 'employee',
        header: 'Employee',
        accessorKey: 'employeeName',
      },
      {
        id: 'checkIn',
        header: 'Check In',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatDateTime(row.original.checkIn)}
          </span>
        ),
      },
      {
        id: 'checkOut',
        header: 'Check Out',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatDateTime(row.original.checkOut)}
          </span>
        ),
      },
      {
        id: 'workedHours',
        header: 'Worked Hours',
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.workedHours.toFixed(2)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Attendance"
        breadcrumbs={
          urlEmployeeId !== undefined
            ? [
                { label: 'Employees', to: '/employees' },
                {
                  label: employeeQuery.data?.fullName ?? 'Employee',
                  to: `/employees/${urlEmployeeId}`,
                },
                { label: 'Attendance' },
              ]
            : undefined
        }
        subtitle={
          urlEmployeeId !== undefined
            ? `Filtered to ${employeeQuery.data?.fullName ?? 'this employee'}.`
            : undefined
        }
        actions={
          canManage ? (
            <Button
              onClick={() => {
                void navigate('/attendance/new');
              }}
            >
              New
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Button
          type="button"
          variant={todayOnly ? 'primary' : 'secondary'}
          size="sm"

          onClick={() => {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (todayOnly) {
                next.delete('from');
                next.delete('to');
              } else {
                next.set('from', today);
                next.set('to', today);
              }
              return next;
            });
            setPage(1);
          }}
        >
          Today
        </Button>

        <Field label="From" htmlFor="attendance-from" className="w-40">
          <Input
            id="attendance-from"
            type="date"
            value={from}
            max={to === '' ? undefined : to}
            onChange={(event) => {
              setDateParam('from', event.target.value);
            }}
          />
        </Field>
        <Field label="To" htmlFor="attendance-to" className="w-40">
          <Input
            id="attendance-to"
            type="date"
            value={to}
            min={from === '' ? undefined : from}
            onChange={(event) => {
              setDateParam('to', event.target.value);
            }}
          />
        </Field>

        {canManage && urlEmployeeId === undefined && (
          <Select
            aria-label="Filter by employee"
            className="max-w-56"
            options={employeeOptions}
            placeholder="All employees"
            value={employeeFilter ?? ''}
            onChange={(event) => {
              setEmployeeFilter(
                event.target.value === '' ? undefined : event.target.value,
              );
              setPage(1);
            }}
          />
        )}

        <Select
          aria-label="Filter by status"
          className="max-w-48"
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={status ?? ''}
          onChange={(event) => {
            setStatus(
              event.target.value === '' ? undefined : event.target.value,
            );
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={attendanceQuery.isLoading}
        isError={attendanceQuery.isError}
        errorMessage="Could not load attendance. The API may still be starting up."
        emptyTitle="No attendance records found"
        emptyDescription="Try a different filter, or add a manual record."
        onRowClick={(row) => {
          void navigate(`/attendance/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {attendanceQuery.data !== undefined && (
        <Pagination
          page={attendanceQuery.data.page}
          pageSize={attendanceQuery.data.pageSize}
          total={attendanceQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
