import {
  CONTRACT_STATUSES,
  contractSchema,
  type ContractInput,
  type ContractStatus,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useContract,
  useCreateContract,
  useUpdateContract,
} from '../../api/contracts.js';
import { useDepartments } from '../../api/departments.js';
import { useEmployees } from '../../api/employees.js';
import { useJobPositions } from '../../api/jobPositions.js';
import { useWorkingSchedules } from '../../api/workingSchedules.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface ContractFormValues {
  reference: string;
  employeeId: string;
  startDate: string;
  endDate?: string | undefined;
  wageMonthly: number;
  departmentId?: string | undefined;
  jobPositionId?: string | undefined;
  workingScheduleId?: string | undefined;
  salaryStructureId?: string | undefined;
  status: ContractStatus;
  notes?: string | undefined;
}

const STATUS_OPTIONS = CONTRACT_STATUSES.map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
}));

const EMPTY_VALUES = (employeeId?: string): ContractFormValues => ({
  reference: '',
  employeeId: employeeId ?? '',
  startDate: '',
  endDate: undefined,
  wageMonthly: 0,
  departmentId: undefined,
  jobPositionId: undefined,
  workingScheduleId: undefined,
  salaryStructureId: undefined,
  status: 'DRAFT',
  notes: undefined,
});

export function ContractFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillEmployeeId = searchParams.get('employeeId') ?? undefined;

  const [formError, setFormError] = useState<string | null>(null);

  const contractQuery = useContract(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });
  const departmentsQuery = useDepartments({ pageSize: 200 });
  const jobPositionsQuery = useJobPositions();
  const schedulesQuery = useWorkingSchedules({ pageSize: 200 });

  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContractFormValues, unknown, ContractInput>({
    resolver: typedZodResolver<ContractFormValues, ContractInput>(
      contractSchema,
    ),
    defaultValues: EMPTY_VALUES(prefillEmployeeId),
  });

  useEffect(() => {
    if (contractQuery.data === undefined) {
      return;
    }
    const detail = contractQuery.data;
    reset({
      reference: detail.reference,
      employeeId: detail.employeeId,
      startDate: detail.startDate.slice(0, 10),
      endDate: detail.endDate?.slice(0, 10) ?? undefined,
      wageMonthly: detail.wageMonthly / 100,
      departmentId: detail.departmentId ?? undefined,
      jobPositionId: detail.jobPositionId ?? undefined,
      workingScheduleId: detail.workingScheduleId ?? undefined,
      salaryStructureId: detail.salaryStructureId ?? undefined,
      status: detail.status,
      notes: detail.notes ?? undefined,
    });
  }, [contractQuery.data, reset]);

  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));
  const departmentOptions = (departmentsQuery.data?.rows ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));
  const jobPositionOptions = (jobPositionsQuery.data ?? []).map((jp) => ({
    value: jp.id,
    label: jp.title,
  }));
  const scheduleOptions = (schedulesQuery.data?.rows ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const backTarget =
    prefillEmployeeId !== undefined
      ? `/contracts?employeeId=${prefillEmployeeId}`
      : '/contracts';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate(backTarget);
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <div>
      <PageHeader
        title={
          isNew ? 'New Contract' : (contractQuery.data?.reference ?? 'Contract')
        }
        breadcrumbs={[
          { label: 'Contracts', to: '/contracts' },
          { label: isNew ? 'New' : (contractQuery.data?.reference ?? '...') },
        ]}
      />

      {contractQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this contract. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate(backTarget);
        }}
        error={formError}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Reference"
            htmlFor="reference"
            required
            error={errors.reference?.message}
          >
            <Input id="reference" {...register('reference')} />
          </Field>
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
            label="Start Date"
            htmlFor="startDate"
            required
            error={errors.startDate?.message}
          >
            <Input id="startDate" type="date" {...register('startDate')} />
          </Field>
          <Field
            label="End Date"
            htmlFor="endDate"
            hint="Leave empty for an open-ended contract."
            error={errors.endDate?.message}
          >
            <Input
              id="endDate"
              type="date"
              {...register('endDate', { setValueAs: emptyToUndefined })}
            />
          </Field>
          <Field
            label="Wage / Month (₹)"
            htmlFor="wageMonthly"
            required
            error={errors.wageMonthly?.message}
          >
            <Input
              id="wageMonthly"
              type="number"
              step="0.01"
              min="0"
              className="font-mono"
              {...register('wageMonthly', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Status"
            htmlFor="status"
            required
            error={errors.status?.message}
          >
            <Select
              id="status"
              options={STATUS_OPTIONS}
              {...register('status')}
            />
          </Field>
          <Field
            label="Department"
            htmlFor="departmentId"
            error={errors.departmentId?.message}
          >
            <Select
              id="departmentId"
              options={departmentOptions}
              placeholder="No department"
              {...register('departmentId', { setValueAs: emptyToUndefined })}
            />
          </Field>
          <Field
            label="Job Position"
            htmlFor="jobPositionId"
            error={errors.jobPositionId?.message}
          >
            <Select
              id="jobPositionId"
              options={jobPositionOptions}
              placeholder="No job position"
              {...register('jobPositionId', { setValueAs: emptyToUndefined })}
            />
          </Field>
          <Field
            label="Working Schedule"
            htmlFor="workingScheduleId"
            error={errors.workingScheduleId?.message}
          >
            <Select
              id="workingScheduleId"
              options={scheduleOptions}
              placeholder="No schedule"
              {...register('workingScheduleId', {
                setValueAs: emptyToUndefined,
              })}
            />
          </Field>
          <Field
            label="Salary Structure ID"
            htmlFor="salaryStructureId"
            hint="Optional — assigned by Payroll."
            error={errors.salaryStructureId?.message}
          >
            <Input
              id="salaryStructureId"
              className="font-mono"
              {...register('salaryStructureId', {
                setValueAs: emptyToUndefined,
              })}
            />
          </Field>
          <Field
            label="Notes"
            htmlFor="notes"
            className="sm:col-span-2"
            error={errors.notes?.message}
          >
            <Textarea
              id="notes"
              rows={3}
              {...register('notes', { setValueAs: emptyToUndefined })}
            />
          </Field>
        </div>
      </FormShell>
    </div>
  );
}
