import {
  APPROVAL_LEVELS,
  TIME_OFF_UNITS,
  timeOffTypeSchema,
  type ApprovalLevel,
  type TimeOffTypeInput,
  type TimeOffUnit,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateTimeOffType,
  useTimeOffType,
  useUpdateTimeOffType,
} from '../../api/timeoff.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface TimeOffTypeFormValues {
  name: string;
  code: string;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  approvalLevel: ApprovalLevel;
  payrollWorkEntry?: string | undefined;
  isPaid: boolean;
  color: string;
  active: boolean;
}

const UNIT_OPTIONS = TIME_OFF_UNITS.map((value) => ({
  value,
  label: value === 'DAYS' ? 'Days' : 'Hours',
}));

const APPROVAL_OPTIONS: Record<ApprovalLevel, string> = {
  NONE: 'No Validation',
  MANAGER: 'Manager',
  OFFICER: 'HR Officer',
};

const APPROVAL_LEVEL_OPTIONS = APPROVAL_LEVELS.map((value) => ({
  value,
  label: APPROVAL_OPTIONS[value],
}));

const EMPTY_VALUES: TimeOffTypeFormValues = {
  name: '',
  code: '',
  unit: 'DAYS',
  requiresAllocation: true,
  approvalLevel: 'MANAGER',
  payrollWorkEntry: undefined,
  isPaid: true,
  color: 'info',
  active: true,
};

export function TimeOffTypeFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [formError, setFormError] = useState<string | null>(null);

  const typeQuery = useTimeOffType(isNew ? undefined : id);
  const createMutation = useCreateTimeOffType();
  const updateMutation = useUpdateTimeOffType(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimeOffTypeFormValues, unknown, TimeOffTypeInput>({
    resolver: typedZodResolver<TimeOffTypeFormValues, TimeOffTypeInput>(
      timeOffTypeSchema,
    ),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (typeQuery.data === undefined) {
      return;
    }
    const detail = typeQuery.data;
    reset({
      name: detail.name,
      code: detail.code,
      unit: detail.unit,
      requiresAllocation: detail.requiresAllocation,
      approvalLevel: detail.approvalLevel,
      payrollWorkEntry: detail.payrollWorkEntry ?? undefined,
      isPaid: detail.isPaid,
      color: detail.color,
      active: detail.active,
    });
  }, [typeQuery.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate('/time-off/types');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <div>
      <PageHeader
        title={
          isNew
            ? 'New Time Off Type'
            : (typeQuery.data?.name ?? 'Time Off Type')
        }
        breadcrumbs={[
          { label: 'Time Off Types', to: '/time-off/types' },
          { label: isNew ? 'New' : (typeQuery.data?.name ?? '...') },
        ]}
      />

      {typeQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this time off type. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/time-off/types');
        }}
        error={formError}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="name"
            required
            error={errors.name?.message}
          >
            <Input id="name" {...register('name')} />
          </Field>
          <Field
            label="Code"
            htmlFor="code"
            required
            error={errors.code?.message}
          >
            <Input
              id="code"
              className="font-mono uppercase"
              {...register('code')}
            />
          </Field>
          <Field
            label="Unit"
            htmlFor="unit"
            required
            error={errors.unit?.message}
          >
            <Select id="unit" options={UNIT_OPTIONS} {...register('unit')} />
          </Field>
          <Field
            label="Approval"
            htmlFor="approvalLevel"
            required
            error={errors.approvalLevel?.message}
          >
            <Select
              id="approvalLevel"
              options={APPROVAL_LEVEL_OPTIONS}
              {...register('approvalLevel')}
            />
          </Field>
          <Field
            label="Payroll Work Entry"
            htmlFor="payrollWorkEntry"
            hint="Optional label carried onto payroll work entries."
            error={errors.payrollWorkEntry?.message}
          >
            <Input
              id="payrollWorkEntry"
              {...register('payrollWorkEntry', {
                setValueAs: emptyToUndefined,
              })}
            />
          </Field>
          <Field label="Color" htmlFor="color" error={errors.color?.message}>
            <Input id="color" {...register('color')} />
          </Field>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              id="requiresAllocation"
              {...register('requiresAllocation')}
            />
            <label htmlFor="requiresAllocation" className="text-sm">
              Requires an approved allocation to take leave
            </label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="isPaid" {...register('isPaid')} />
            <label htmlFor="isPaid" className="text-sm">
              Paid time off
            </label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="active" {...register('active')} />
            <label htmlFor="active" className="text-sm">
              Active
            </label>
          </div>
        </div>
      </FormShell>
    </div>
  );
}
