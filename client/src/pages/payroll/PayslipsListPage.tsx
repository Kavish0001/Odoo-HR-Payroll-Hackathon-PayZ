import { formatINR, type PayslipRow } from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { usePayslips } from '../../api/payruns.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Pagination } from '../../components/data/Pagination.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { useAuth } from '../../lib/auth.js';

const PAGE_SIZE = 20;

export function PayslipsListPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { allowed } = useAuth();
  const [searchParams] = useSearchParams();
  const payrunId = searchParams.get('payrunId') ?? undefined;
  const employeeId = searchParams.get('employeeId') ?? undefined;

  // Two screens share this route. Payroll staff see everybody's payslips and
  // need to know whose each one is; everyone else sees only their own, which
  // the API enforces by ignoring any employeeId asked for here. For them the
  // Employee column would repeat their own name down the page, and the
  // payroll warnings are HR's queue, not something to hand the person whose
  // bank details are missing as a column of jargon.
  const isPayrollView = allowed('read', 'payslip');

  const [page, setPage] = useState(1);

  const payslipsQuery = usePayslips({
    page,
    pageSize: PAGE_SIZE,
    payrunId,
    employeeId,
  });
  const rows = payslipsQuery.data?.rows ?? [];

  const columns = useMemo<ColumnDef<PayslipRow>[]>(
    () => [
      ...(isPayrollView
        ? [
            {
              id: 'employee',
              header: 'Employee',
              accessorKey: 'employeeName',
            } satisfies ColumnDef<PayslipRow>,
            {
              id: 'warning',
              header: 'Warning',
              cell: ({ row }) =>
                row.original.warnings.length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className="bg-warning-soft text-warning-strong inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                    {row.original.warnings.join(', ')}
                  </span>
                ),
            } satisfies ColumnDef<PayslipRow>,
          ]
        : []),
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
      {
        id: 'basic',
        header: 'Basic',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatINR(row.original.basicAmount)}
          </span>
        ),
      },
      {
        id: 'gross',
        header: 'Gross',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatINR(row.original.grossAmount)}
          </span>
        ),
      },
      {
        id: 'net',
        header: 'Net',
        cell: ({ row }) => (
          <span className="font-mono">{formatINR(row.original.netAmount)}</span>
        ),
      },
      { id: 'structure', header: 'Structure', accessorKey: 'structureName' },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [isPayrollView],
  );

  return (
    <div>
      <PageHeader
        title={isPayrollView ? 'Payslips' : 'My Payslips'}
        subtitle={
          !isPayrollView
            ? 'Your own payslips. Open one to see how the amount was worked out, or to save the PDF.'
            : payrunId !== undefined
              ? 'Filtered to one payrun.'
              : employeeId !== undefined
                ? 'Filtered to one employee.'
                : undefined
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isLoading={payslipsQuery.isLoading}
        isError={payslipsQuery.isError}
        errorMessage="Could not load payslips. The API may still be starting up."
        emptyTitle={isPayrollView ? 'No payslips found' : 'No payslips yet'}
        emptyDescription={
          isPayrollView
            ? 'Payslips appear once a payrun has been computed.'
            : 'Your payslips appear here once payroll has been run for a period you worked.'
        }
        onRowClick={(row) => {
          void navigate(`/payroll/payslips/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
      {payslipsQuery.data !== undefined && (
        <Pagination
          page={payslipsQuery.data.page}
          pageSize={payslipsQuery.data.pageSize}
          total={payslipsQuery.data.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
