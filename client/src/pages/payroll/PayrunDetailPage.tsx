import {
  canCompute,
  canTransition,
  formatINR,
  isPayrunLocked,
  WARNING_LABELS,
  type PayrollWarningRow,
  type PayslipRow,
} from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  isVersionConflict,
  useAcknowledgeWarning,
  useCancelPayrun,
  useComputePayrun,
  useMarkPayrunPaid,
  usePayrun,
  useSendPayslips,
  useValidatePayrun,
} from '../../api/payruns.js';
import { DataTable } from '../../components/data/DataTable.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { useAuth } from '../../lib/auth.js';

/**
 * The processing screen. Every button's enabled state comes straight from
 * `canTransition`/`canCompute` in `@payz/shared` (rule W4) — there is no
 * second copy of the state machine here that could drift from the one the
 * API enforces.
 */
export function PayrunDetailPage(): React.JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allowed } = useAuth();

  const payrunQuery = usePayrun(id);
  const computeMutation = useComputePayrun();
  const validateMutation = useValidatePayrun();
  const markPaidMutation = useMarkPayrunPaid();
  const cancelMutation = useCancelPayrun();
  const sendPayslipsMutation = useSendPayslips();
  const acknowledgeMutation = useAcknowledgeWarning();

  const [actionError, setActionError] = useState<string | null>(null);
  const [sendSummary, setSendSummary] = useState<string | null>(null);

  const payrun = payrunQuery.data;
  const canWrite = allowed('update', 'payrun');

  const payslipColumns = useMemo<ColumnDef<PayslipRow>[]>(
    () => [
      { id: 'employee', header: 'Employee', accessorKey: 'employeeName' },
      {
        id: 'warnings',
        header: 'Warning',
        cell: ({ row }) =>
          row.original.warnings.length === 0 ? (
            <span className="text-muted">—</span>
          ) : (
            <span className="bg-warning-soft text-warning-strong inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
              {row.original.warnings.join(', ')}
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
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  if (payrunQuery.isLoading) {
    return <p className="text-muted text-sm">Loading…</p>;
  }
  if (payrunQuery.isError || payrun === undefined) {
    return (
      <p className="border-danger/30 bg-danger/5 text-danger rounded-md border px-3 py-2 text-sm">
        Could not load this payrun.
      </p>
    );
  }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setActionError(null);
    setSendSummary(null);
    try {
      await action();
    } catch (error) {
      if (isVersionConflict(error)) {
        // Optimistic lock: someone else changed this payrun since it was
        // loaded. Refetch so the buttons and warnings reflect reality again
        // rather than staying stuck on the stale version we sent.
        setActionError('This payrun changed elsewhere, reload.');
        await payrunQuery.refetch();
      } else {
        setActionError(toApiError(error).message);
      }
    }
  }

  const blockingWarnings = payrun.warnings.filter((w) => w.blocking);
  const advisoryWarnings = payrun.warnings.filter((w) => !w.blocking);
  const unacknowledgedAdvisory = advisoryWarnings.filter(
    (w) => w.acknowledgedAt === null,
  );

  return (
    <div>
      <PageHeader
        title={payrun.name}
        breadcrumbs={[
          { label: 'Payruns', to: '/payroll/payruns' },
          { label: payrun.name },
        ]}
        subtitle={`${payrun.structureName} · ${payrun.periodStart.slice(0, 10)} – ${payrun.periodEnd.slice(0, 10)}`}
        actions={<StatusBadge status={payrun.status} dot />}
      />

      {canWrite && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            disabled={!canCompute(payrun.status) || computeMutation.isPending}
            onClick={() => {
              void run(() =>
                computeMutation.mutateAsync({
                  id: payrun.id,
                  version: payrun.version,
                }),
              );
            }}
          >
            {computeMutation.isPending ? 'Computing…' : 'Compute'}
          </Button>
          <Button
            disabled={
              !canTransition(payrun.status, 'VALIDATED') ||
              blockingWarnings.length > 0 ||
              unacknowledgedAdvisory.length > 0 ||
              validateMutation.isPending
            }
            title={
              blockingWarnings.length > 0
                ? 'Blocking warnings must be fixed and recomputed first.'
                : unacknowledgedAdvisory.length > 0
                  ? 'Acknowledge every advisory warning first.'
                  : undefined
            }
            onClick={() => {
              void run(() =>
                validateMutation.mutateAsync({
                  id: payrun.id,
                  version: payrun.version,
                }),
              );
            }}
          >
            {validateMutation.isPending ? 'Validating…' : 'Validate'}
          </Button>
          <Button
            disabled={
              !canTransition(payrun.status, 'PAID') ||
              markPaidMutation.isPending
            }
            onClick={() => {
              void run(() =>
                markPaidMutation.mutateAsync({
                  id: payrun.id,
                  version: payrun.version,
                }),
              );
            }}
          >
            {markPaidMutation.isPending ? 'Marking Paid…' : 'Mark Paid'}
          </Button>
          <Button
            disabled={
              !isPayrunLocked(payrun.status) || sendPayslipsMutation.isPending
            }
            onClick={() => {
              void run(async () => {
                const result = await sendPayslipsMutation.mutateAsync({
                  id: payrun.id,
                  version: payrun.version,
                });
                setSendSummary(`${result.sent} sent, ${result.failed} failed.`);
              });
            }}
          >
            {sendPayslipsMutation.isPending ? 'Sending…' : 'Send Payslips'}
          </Button>
          <Button
            variant="ghost"
            className="text-danger ml-auto"
            disabled={
              !canTransition(payrun.status, 'CANCELLED') ||
              cancelMutation.isPending
            }
            onClick={() => {
              void run(() =>
                cancelMutation.mutateAsync({
                  id: payrun.id,
                  version: payrun.version,
                }),
              );
            }}
          >
            Cancel Payrun
          </Button>
        </div>
      )}

      {actionError !== null && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          {actionError}
        </p>
      )}
      {sendSummary !== null && (
        <p className="border-success-line bg-success-soft text-success-strong mb-4 rounded-md border px-3 py-2 text-sm">
          {sendSummary}
        </p>
      )}

      {payrun.warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-muted text-xs">
            {blockingWarnings.length > 0
              ? `${String(blockingWarnings.length)} blocking warning${blockingWarnings.length === 1 ? '' : 's'} — fix the underlying data and recompute before Validate is available.`
              : unacknowledgedAdvisory.length > 0
                ? `${String(unacknowledgedAdvisory.length)} advisory warning${unacknowledgedAdvisory.length === 1 ? '' : 's'} must be acknowledged before Validate.`
                : 'All warnings resolved.'}
          </p>
          {blockingWarnings.map((warning) => (
            <WarningRow key={warning.id} warning={warning} />
          ))}
          {advisoryWarnings.map((warning) => (
            <WarningRow
              key={warning.id}
              warning={warning}
              onAcknowledge={
                canWrite && warning.acknowledgedAt === null
                  ? () => {
                      void run(() =>
                        acknowledgeMutation.mutateAsync({
                          payrunId: payrun.id,
                          warningId: warning.id,
                        }),
                      );
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <DataTable
        columns={payslipColumns}
        data={payrun.payslips}
        emptyTitle="No payslips yet"
        emptyDescription="Nothing has been computed for this payrun."
        onRowClick={(row) => {
          void navigate(`/payroll/payslips/${row.id}`);
        }}
        getRowId={(row) => row.id}
      />
    </div>
  );
}

function WarningRow({
  warning,
  onAcknowledge,
}: {
  warning: PayrollWarningRow;
  onAcknowledge?: (() => void) | undefined;
}): React.JSX.Element {
  const tone = warning.blocking
    ? 'border-danger-line bg-danger-soft text-danger-strong'
    : 'border-warning-line bg-warning-soft text-warning-strong';

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${tone}`}
    >
      <div>
        <span className="font-medium">{WARNING_LABELS[warning.code]}</span>
        {warning.employeeName !== null && (
          <span> — {warning.employeeName}</span>
        )}
        <span className="block text-xs opacity-80">{warning.message}</span>
      </div>
      {warning.blocking ? (
        <span className="text-xs font-medium whitespace-nowrap">
          Fix &amp; recompute
        </span>
      ) : warning.acknowledgedAt !== null ? (
        <span className="text-xs font-medium whitespace-nowrap">
          Acknowledged
        </span>
      ) : onAcknowledge !== undefined ? (
        <Button size="sm" variant="secondary" onClick={onAcknowledge}>
          Acknowledge
        </Button>
      ) : null}
    </div>
  );
}
