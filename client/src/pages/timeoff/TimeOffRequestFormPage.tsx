import { timeOffRequestSchema, type TimeOffRequestInput } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useEmployees } from '../../api/employees.js';
import {
  useApproveTimeOffRequest,
  useCreateTimeOffRequest,
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

  const requestQuery = useTimeOffRequest(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });
  const typesQuery = useTimeOffTypes({ pageSize: 200, active: 'true' });

  const createMutation = useCreateTimeOffRequest();
  const updateMutation = useUpdateTimeOffRequest(id);
  const approveMutation = useApproveTimeOffRequest();
  const refuseMutation = useRefuseTimeOffRequest();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
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

  const detail = requestQuery.data;
  const isEditable = isNew || detail?.status === 'TO_APPROVE';
  const canApprove = !isNew && allowed('update', 'timeOffRequest');
  const pendingReview = detail?.status === 'TO_APPROVE';

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
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
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
          canApprove && pendingReview ? (
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
