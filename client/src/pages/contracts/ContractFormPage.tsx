import {
  CONTRACT_STATUSES,
  contractSchema,
  formatINR,
  type ContractInput,
  type ContractRow,
  type ContractStatus,
  type EmployeeDetail,
} from '@payz/shared';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useContract,
  useContracts,
  useCreateContract,
  useUpdateContract,
} from '../../api/contracts.js';
import { useDepartments } from '../../api/departments.js';
import { useEmployee, useEmployees } from '../../api/employees.js';
import { useJobPositionOptions } from '../../api/jobPositions.js';
import { useWorkingSchedules } from '../../api/workingSchedules.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuth } from '../../lib/auth.js';
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
  const { allowed } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillEmployeeId = searchParams.get('employeeId') ?? undefined;

  // Read on this resource sits at EMPLOYEE so other forms can resolve
  // its names; changing it is HR's. Anyone without the write permission
  // reads the record instead of being handed inputs and a Save button
  // that answers 403.
  const canWrite = allowed(isNew ? 'create' : 'update', 'contract');
  const [formError, setFormError] = useState<string | null>(null);

  const contractQuery = useContract(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });
  const departmentsQuery = useDepartments({ pageSize: 200 });
  const jobPositionsQuery = useJobPositionOptions();
  const schedulesQuery = useWorkingSchedules({ pageSize: 200 });

  const createMutation = useCreateContract();
  const updateMutation = useUpdateContract(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
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

  // Watched, because everything below reacts to it: an employee carries the
  // department, position and schedule a contract would otherwise be retyped
  // with, and the contracts they already hold decide whether this one can
  // even be saved.
  const selectedEmployeeId = watch('employeeId');
  const employeeDetailQuery = useEmployee(
    selectedEmployeeId === '' ? undefined : selectedEmployeeId,
  );
  const employee = employeeDetailQuery.data;

  const employeeContractsQuery = useContracts(
    selectedEmployeeId === ''
      ? { pageSize: 1 }
      : { employeeId: selectedEmployeeId, pageSize: 50 },
  );
  const otherContracts = (employeeContractsQuery.data?.rows ?? []).filter(
    (row) => row.id !== id,
  );
  const runningContract = otherContracts.find(
    (row) => row.status === 'RUNNING',
  );

  /**
   * Carry the employee's own department, position and schedule onto the
   * contract when the employee changes.
   *
   * These three are the contract's payroll context and they almost always
   * match the employee record, so retyping them is work the form can do. It
   * fills only what is still blank, and only when the employee actually
   * changes -- picking someone, correcting a field, then picking them again
   * must not quietly undo the correction. Editing an existing contract is
   * left alone entirely: its stored values are the record.
   */
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isNew || employee === undefined) {
      return;
    }
    if (prefilledFor.current === employee.id) {
      return;
    }
    prefilledFor.current = employee.id;

    const current = getValues();
    if (current.departmentId === undefined && employee.departmentId !== null) {
      setValue('departmentId', employee.departmentId);
    }
    if (
      current.jobPositionId === undefined &&
      employee.jobPositionId !== null
    ) {
      setValue('jobPositionId', employee.jobPositionId);
    }
    if (
      current.workingScheduleId === undefined &&
      employee.workingScheduleId !== null
    ) {
      setValue('workingScheduleId', employee.workingScheduleId);
    }
  }, [isNew, employee, getValues, setValue]);

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
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
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
        readOnly={!canWrite}
        readOnlyNote="Contracts are maintained by HR."
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
          <div className="sm:col-span-2">
            <EmployeeContextPanel
              employee={employee}
              isLoading={employeeDetailQuery.isLoading}
              contractCount={otherContracts.length}
              runningContract={runningContract}
              isNew={isNew}
            />
          </div>
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

interface EmployeeContextPanelProps {
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  contractCount: number;
  runningContract: ContractRow | undefined;
  isNew: boolean;
}

/**
 * What the chosen employee already is, shown next to the fields it decides.
 *
 * A contract is written against facts that live on the employee record --
 * their department, position and schedule -- and against the contracts they
 * already hold. Both were invisible here, so the department and position had
 * to be remembered and retyped, and an overlapping RUNNING contract only
 * announced itself as a save that failed (rule C1). Reading them out is
 * cheaper than reproducing them from memory.
 */
function EmployeeContextPanel({
  employee,
  isLoading,
  contractCount,
  runningContract,
  isNew,
}: EmployeeContextPanelProps): React.JSX.Element {
  const frame = 'border-steel-300 rounded-md border px-4 py-3';

  if (employee === undefined) {
    return (
      <div className={frame}>
        <p className="eyebrow">Employee</p>
        <p className="text-muted mt-2 text-xs">
          {isLoading
            ? 'Loading their record…'
            : 'Pick an employee to see the department, position and schedule this contract will inherit.'}
        </p>
      </div>
    );
  }

  const facts: { label: string; value: string }[] = [
    { label: 'Code', value: employee.code },
    { label: 'Department', value: employee.departmentName ?? '—' },
    { label: 'Position', value: employee.jobPositionTitle ?? '—' },
    { label: 'Schedule', value: employee.scheduleName ?? '—' },
    { label: 'Manager', value: employee.managerName ?? '—' },
    {
      label: 'Joined',
      value: employee.joinDate?.slice(0, 10) ?? '—',
    },
  ];

  return (
    <div className={frame}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">{employee.fullName}</p>
        <p className="text-muted font-mono text-xs">
          {contractCount === 0
            ? 'No other contracts'
            : `${contractCount} other contract${contractCount === 1 ? '' : 's'}`}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted text-[11px] tracking-wide uppercase">
              {fact.label}
            </dt>
            <dd className="mt-0.5 text-sm">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {!employee.active && (
        <p className="border-warning-line bg-warning-soft text-ink mt-3 rounded-sm border px-3 py-2 text-xs">
          This employee is archived. Payroll skips inactive employees, so a
          contract written now will not produce a payslip until they are
          reactivated.
        </p>
      )}

      {runningContract !== undefined && (
        /* Rule C1 is a database constraint: a second RUNNING contract whose
           dates overlap is refused outright. Saying so here turns a rejected
           save into a decision made before typing the rest of the form. */
        <div className="border-danger-line bg-danger-soft mt-3 rounded-sm border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge status={runningContract.status} />
            <span className="font-mono">{runningContract.reference}</span>
            <span className="text-muted">
              from {runningContract.startDate.slice(0, 10)}
              {runningContract.endDate === null
                ? ' — open-ended'
                : ` to ${runningContract.endDate.slice(0, 10)}`}
            </span>
            <span className="font-mono">
              {formatINR(runningContract.wageMonthly)}
            </span>
          </div>
          <p className="text-muted mt-1.5 text-xs">
            They already hold a running contract. Only one can run over any
            given date, so this one has to start after that one ends — or that
            one has to be closed first.
          </p>
        </div>
      )}

      {isNew && (
        <p className="text-muted mt-3 text-xs">
          Department, position and schedule below were filled in from this
          record. Change any of them if this contract differs.
        </p>
      )}
    </div>
  );
}
