import {
  timeOffRequestSchema,
  type LeaveBalanceRow,
  type TimeOffRequestInput,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useEmployees } from '../../api/employees.js';
import {
  useApproveTimeOffRequest,
  useCreateTimeOffRequest,
  useDeleteTimeOffRequest,
  useLeaveBalances,
  useRefuseTimeOffRequest,
  useTimeOffRequest,
  useTimeOffTypes,
  useUpdateTimeOffRequest,
} from '../../api/timeoff.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuth } from '../../lib/auth.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

import { formatQty } from './format.js';

interface TimeOffRequestFormValues {
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  reason?: string | undefined;
}

const EMPTY_VALUES = (employeeId?: string): TimeOffRequestFormValues => ({
  employeeId: employeeId ?? '',
  typeId: '',
  startDate: '',
  endDate: '',
  reason: undefined,
});

export function TimeOffRequestFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { allowed, user } = useAuth();
  const [searchParams] = useSearchParams();
  const prefillEmployeeId =
    searchParams.get('employeeId') ?? user?.employeeId ?? undefined;

  const [formError, setFormError] = useState<string | null>(null);

  // Somebody filing their own leave is not choosing whose leave it is. The
  // API pins a self-scoped caller to their own employee id regardless, so the
  // picker would offer a choice of exactly one name -- and the colleague list
  // behind it is not theirs to read.
  const picksEmployee = allowed('approve', 'timeOffRequest');

  const requestQuery = useTimeOffRequest(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 }, picksEmployee);
  const typesQuery = useTimeOffTypes({ pageSize: 200, active: 'true' });

  const createMutation = useCreateTimeOffRequest();
  const updateMutation = useUpdateTimeOffRequest(id);
  const approveMutation = useApproveTimeOffRequest();
  const refuseMutation = useRefuseTimeOffRequest();
  const cancelMutation = useDeleteTimeOffRequest();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TimeOffRequestFormValues, unknown, TimeOffRequestInput>({
    resolver: typedZodResolver<TimeOffRequestFormValues, TimeOffRequestInput>(
      timeOffRequestSchema,
    ),
    defaultValues: EMPTY_VALUES(prefillEmployeeId),
  });

  useEffect(() => {
    if (requestQuery.data === undefined) {
      return;
    }
    const detail = requestQuery.data;
    reset({
      employeeId: detail.employeeId,
      typeId: detail.typeId,
      startDate: detail.startDate.slice(0, 10),
      endDate: detail.endDate.slice(0, 10),
      reason: detail.reason ?? undefined,
    });
  }, [requestQuery.data, reset]);

  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));
  const typeOptions = (typesQuery.data?.rows ?? []).map((t) => ({
    value: t.id,
    label: t.name,
  }));

  // Watched, not read once: the balance has to follow the pickers, so somebody
  // sees what is left for the type they are about to request — before they
  // submit it, rather than after an approver refuses it.
  const selectedEmployeeId = watch('employeeId');
  const selectedTypeId = watch('typeId');

  const balancesQuery = useLeaveBalances(
    selectedEmployeeId === '' ? undefined : selectedEmployeeId,
  );
  const selectedBalance = (balancesQuery.data ?? []).find(
    (balance) => balance.typeId === selectedTypeId,
  );

  const detail = requestQuery.data;
  const isEditable = isNew || detail?.status === 'TO_APPROVE';
  const pendingReview = detail?.status === 'TO_APPROVE';

  // Deciding a request and owning one are different capabilities, and were
  // the same check until now: 'update' is granted to EMPLOYEE so they can
  // edit their own request while it is pending, which meant every employee
  // was offered Approve and Refuse on it (rule T8).
  const canApprove = !isNew && allowed('approve', 'timeOffRequest');
  const isOwnRequest =
    detail !== undefined && user?.employeeId === detail.employeeId;
  // The other half of being allowed to file a request: withdrawing it. An
  // approver refuses; the person who asked cancels.
  const canWithdraw = isOwnRequest && !canApprove && pendingReview;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate('/time-off/requests');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <div>
      <PageHeader
        title={
          isNew
            ? 'New Time Off Request'
            : (detail?.typeName ?? 'Time Off Request')
        }
        breadcrumbs={[
          { label: 'Time Off', to: '/time-off/requests' },
          { label: isNew ? 'New' : (detail?.typeName ?? '...') },
        ]}
        actions={
          detail !== undefined ? (
            <StatusBadge status={detail.status} />
          ) : undefined
        }
      />

      {requestQuery.isError && !isNew && (
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
          Could not load this time off request. The API may still be starting
          up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        disableSave={!isEditable}
        onDiscard={() => {
          void navigate('/time-off/requests');
        }}
        error={formError}
        footerExtra={
          canWithdraw ? (
            <Button
              type="button"
              variant="secondary"
              className="text-danger ml-auto"
              onClick={() => {
                cancelMutation.mutate(id, {
                  onSuccess: () => {
                    void navigate('/time-off/requests');
                  },
                });
              }}
              disabled={cancelMutation.isPending}
            >
              Withdraw request
            </Button>
          ) : canApprove && pendingReview ? (
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="text-success"
                onClick={() => {
                  approveMutation.mutate(id);
                }}
                disabled={approveMutation.isPending}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="text-danger"
                onClick={() => {
                  refuseMutation.mutate(id);
                }}
                disabled={refuseMutation.isPending}
              >
                Refuse
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {picksEmployee ? (
            <Field
              label="Employee"
              htmlFor="employeeId"
              required
              error={errors.employeeId?.message}
            >
              <Select
                id="employeeId"
                options={employeeOptions}
                placeholder="Select an employee"
                disabled={!isEditable}
                {...register('employeeId')}
              />
            </Field>
          ) : (
            <Field label="Employee" htmlFor="employeeId">
              {/* Registered, not merely displayed: the value still has to
                  reach the payload, and a read-only input keeps it there
                  without offering it up for editing. */}
              <Input
                id="employeeId"
                readOnly
                value={user?.employeeName ?? 'You'}
              />
              <input type="hidden" {...register('employeeId')} />
            </Field>
          )}
          <Field
            label="Time Off Type"
            htmlFor="typeId"
            required
            error={errors.typeId?.message}
          >
            <Select
              id="typeId"
              options={typeOptions}
              placeholder="Select a type"
              disabled={!isEditable}
              {...register('typeId')}
            />
          </Field>
          <div className="sm:col-span-2">
            <BalancePanel
              balance={selectedBalance}
              isLoading={balancesQuery.isLoading}
              hasEmployee={selectedEmployeeId !== ''}
              hasType={selectedTypeId !== ''}
            />
          </div>
          <Field
            label="Start Date"
            htmlFor="startDate"
            required
            error={errors.startDate?.message}
          >
            <Input
              id="startDate"
              type="date"
              disabled={!isEditable}
              {...register('startDate')}
            />
          </Field>
          <Field
            label="End Date"
            htmlFor="endDate"
            required
            error={errors.endDate?.message}
          >
            <Input
              id="endDate"
              type="date"
              disabled={!isEditable}
              {...register('endDate')}
            />
          </Field>
          {!isNew && (
            <>
              <Field label="Duration" htmlFor="duration">
                <Input
                  id="duration"
                  readOnly
                  className="font-mono"
                  value={
                    detail !== undefined
                      ? `${detail.duration} ${detail.unit === 'DAYS' ? 'day(s)' : 'hour(s)'}`
                      : ''
                  }
                />
              </Field>
              <Field label="Allocation Used" htmlFor="allocationUsed">
                <Input
                  id="allocationUsed"
                  readOnly
                  value={detail?.allocationName ?? 'N/A'}
                />
              </Field>
            </>
          )}
          <Field
            label="Reason"
            htmlFor="reason"
            className="sm:col-span-2"
            error={errors.reason?.message}
          >
            <Textarea
              id="reason"
              rows={3}
              disabled={!isEditable}
              {...register('reason', { setValueAs: emptyToUndefined })}
            />
          </Field>
        </div>
      </FormShell>
    </div>
  );
}

interface BalancePanelProps {
  balance: LeaveBalanceRow | undefined;
  isLoading: boolean;
  hasEmployee: boolean;
  hasType: boolean;
}

/**
 * The remaining balance for the type being requested, shown at the moment of
 * the request.
 *
 * Every figure is printed as the API derived it. `remaining` already counts
 * only approved requests, so nothing is recomputed here — and in particular
 * `pending` is reported on its own line rather than subtracted, because a
 * request nobody has decided on yet has not spent anything.
 */
function BalancePanel({
  balance,
  isLoading,
  hasEmployee,
  hasType,
}: BalancePanelProps): React.JSX.Element {
  const frame = 'border-steel-300 rounded-md border px-4 py-3';

  if (!hasEmployee || !hasType) {
    return (
      <div className={frame}>
        <p className="eyebrow">Leave balance</p>
        <p className="text-muted mt-2 text-xs">
          Pick an employee and a time off type to see the balance that applies.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className={`${frame} bg-steel-100 h-24 animate-pulse`} />;
  }

  if (balance === undefined) {
    return (
      <div className={frame}>
        <p className="eyebrow">Leave balance</p>
        <p className="text-muted mt-2 text-xs">
          No balance is recorded for this type and employee.
        </p>
      </div>
    );
  }

  return (
    <div className={frame}>
      <p className="eyebrow">{balance.typeName} balance</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        {balance.requiresAllocation ? (
          <>
            <p className="font-display text-3xl font-bold tabular-nums">
              {formatQty(balance.remaining, balance.unit)}
            </p>
            <p className="text-muted font-mono text-xs">
              {formatQty(balance.taken, balance.unit)} taken of{' '}
              {formatQty(balance.allocated, balance.unit)} allocated
            </p>
          </>
        ) : (
          <>
            {/* Rule T4: a type needing no allocation has no balance to report,
                and N/A is honest where 0 would read as "you have none left". */}
            <p className="font-display text-muted text-3xl font-bold">N/A</p>
            <p className="text-muted text-xs">
              This type needs no allocation, so it carries no balance.
            </p>
          </>
        )}
      </div>

      {balance.pending > 0 && (
        <p className="text-muted mt-2 text-xs">
          {formatQty(balance.pending, balance.unit)} already requested and
          awaiting approval — not yet deducted from the balance above.
        </p>
      )}
    </div>
  );
}
