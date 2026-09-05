import { allocationSchema, type AllocationInput } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useEmployees } from '../../api/employees.js';
import {
  useAllocation,
  useApproveAllocation,
  useCreateAllocation,
  useRefuseAllocation,
  useTimeOffTypes,
  useUpdateAllocation,
} from '../../api/timeoff.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuth } from '../../lib/auth.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface AllocationFormValues {
  employeeId: string;
  typeId: string;
  name: string;
  allocatedQty: number;
  validFrom: string;
  validTo?: string | undefined;
  description?: string | undefined;
}

const EMPTY_VALUES = (employeeId?: string): AllocationFormValues => ({
  employeeId: employeeId ?? '',
  typeId: '',
  name: '',
  allocatedQty: 0,
  validFrom: '',
  validTo: undefined,
  description: undefined,
});

function formatQty(value: number, unit: 'DAYS' | 'HOURS'): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${unit === 'DAYS' ? 'days' : 'hours'}`;
}

export function AllocationFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { allowed } = useAuth();
  const [searchParams] = useSearchParams();
  const prefillEmployeeId = searchParams.get('employeeId') ?? undefined;

  const [formError, setFormError] = useState<string | null>(null);

  const allocationQuery = useAllocation(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });
  const typesQuery = useTimeOffTypes({ pageSize: 200, active: 'true' });

  const createMutation = useCreateAllocation();
  const updateMutation = useUpdateAllocation(id);
  const approveMutation = useApproveAllocation();
  const refuseMutation = useRefuseAllocation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AllocationFormValues, unknown, AllocationInput>({
    resolver: typedZodResolver<AllocationFormValues, AllocationInput>(
      allocationSchema,
    ),
    defaultValues: EMPTY_VALUES(prefillEmployeeId),
  });

  useEffect(() => {
    if (allocationQuery.data === undefined) {
      return;
    }
    const detail = allocationQuery.data;
    reset({
      employeeId: detail.employeeId,
      typeId: detail.typeId,
      name: detail.name,
      allocatedQty: detail.allocatedQty,
      validFrom: detail.validFrom.slice(0, 10),
      validTo: detail.validTo?.slice(0, 10) ?? undefined,
      description: detail.description ?? undefined,
    });
  }, [allocationQuery.data, reset]);

  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));
  const typeOptions = (typesQuery.data?.rows ?? []).map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate('/time-off/allocations');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  const detail = allocationQuery.data;
  const canApprove = !isNew && allowed('update', 'timeOffAllocation');
  const pendingReview = detail?.status === 'TO_APPROVE';

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Allocation' : (detail?.name ?? 'Allocation')}
        breadcrumbs={[
          { label: 'Allocations', to: '/time-off/allocations' },
          { label: isNew ? 'New' : (detail?.name ?? '...') },
        ]}
        actions={
          detail !== undefined ? (
            <StatusBadge status={detail.status} />
          ) : undefined
        }
      />

      {allocationQuery.isError && !isNew && (
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
          Could not load this allocation. The API may still be starting up.
        </p>
      )}

      {detail !== undefined && (
        <Card className="mb-4 grid grid-cols-3 gap-4 p-4 text-center">
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">
              Allocated
            </p>
            <p className="font-mono text-lg font-bold">
              {formatQty(detail.allocatedQty, detail.unit)}
            </p>
          </div>
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">Taken</p>
            <p className="font-mono text-lg font-bold">
              {formatQty(detail.takenQty, detail.unit)}
            </p>
          </div>
          <div>
            <p className="text-muted text-xs tracking-wide uppercase">
              Remaining
            </p>
            <p className="text-success font-mono text-lg font-bold">
              {formatQty(detail.remainingQty, detail.unit)}
            </p>
          </div>
        </Card>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/time-off/allocations');
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
              disabled={prefillEmployeeId !== undefined}
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
              {...register('typeId')}
            />
          </Field>
          <Field
            label="Name"
            htmlFor="name"
            required
            error={errors.name?.message}
          >
            <Input id="name" {...register('name')} />
          </Field>
          <Field
            label="Allocated Quantity"
            htmlFor="allocatedQty"
            required
            error={errors.allocatedQty?.message}
          >
            <Input
              id="allocatedQty"
              type="number"
              step="0.5"
              min="0"
              className="font-mono"
              {...register('allocatedQty', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Valid From"
            htmlFor="validFrom"
            required
            error={errors.validFrom?.message}
          >
            <Input id="validFrom" type="date" {...register('validFrom')} />
          </Field>
          <Field
            label="Valid To"
            htmlFor="validTo"
            hint="Leave empty for an open-ended allocation."
            error={errors.validTo?.message}
          >
            <Input
              id="validTo"
              type="date"
              {...register('validTo', { setValueAs: emptyToUndefined })}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
            error={errors.description?.message}
          >
            <Textarea
              id="description"
              rows={3}
              {...register('description', { setValueAs: emptyToUndefined })}
            />
          </Field>
        </div>
      </FormShell>
    </div>
  );
}
