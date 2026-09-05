import {
  employeeSchema,
  EMPLOYEE_TYPES,
  type EmployeeInput,
  type EmployeeType,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useDepartments } from '../../api/departments.js';
import {
  useCreateEmployee,
  useEmployee,
  useEmployees,
  useUpdateEmployee,
} from '../../api/employees.js';
import { useJobPositions } from '../../api/jobPositions.js';
import { useWorkingSchedules } from '../../api/workingSchedules.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { SmartButton } from '../../components/data/SmartButton.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Tabs } from '../../components/ui/Tabs.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface EmployeeFormValues {
  code: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  personalEmail?: string | undefined;
  phone?: string | undefined;
  departmentId?: string | undefined;
  jobPositionId?: string | undefined;
  managerId?: string | undefined;
  workingScheduleId?: string | undefined;
  employeeType: EmployeeType;
  workLocation?: string | undefined;
  bankAccount?: string | undefined;
  bankName?: string | undefined;
  bankIfsc?: string | undefined;
  joinDate?: string | undefined;
  active: boolean;
}

const EMPTY_VALUES: EmployeeFormValues = {
  code: '',
  firstName: '',
  lastName: '',
  workEmail: '',
  personalEmail: undefined,
  phone: undefined,
  departmentId: undefined,
  jobPositionId: undefined,
  managerId: undefined,
  workingScheduleId: undefined,
  employeeType: 'FULL_TIME',
  workLocation: undefined,
  bankAccount: undefined,
  bankName: undefined,
  bankIfsc: undefined,
  joinDate: undefined,
  active: true,
};

const EMPLOYEE_TYPE_OPTIONS = EMPLOYEE_TYPES.map((value) => ({
  value,
  label: value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '),
}));

type FormTab = 'work' | 'private';

export function EmployeeFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [tab, setTab] = useState<FormTab>('work');
  const [formError, setFormError] = useState<string | null>(null);

  const employeeQuery = useEmployee(isNew ? undefined : id);
  const departmentsQuery = useDepartments({ pageSize: 200 });
  const jobPositionsQuery = useJobPositions();
  const schedulesQuery = useWorkingSchedules({ pageSize: 200 });
  const managersQuery = useEmployees({ pageSize: 200 });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues, unknown, EmployeeInput>({
    resolver: typedZodResolver<EmployeeFormValues, EmployeeInput>(
      employeeSchema,
    ),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (employeeQuery.data === undefined) {
      return;
    }
    const detail = employeeQuery.data;
    reset({
      code: detail.code,
      firstName: detail.firstName,
      lastName: detail.lastName,
      workEmail: detail.workEmail,
      personalEmail: detail.personalEmail ?? undefined,
      phone: detail.phone ?? undefined,
      departmentId: detail.departmentId ?? undefined,
      jobPositionId: detail.jobPositionId ?? undefined,
      managerId: detail.managerId ?? undefined,
      workingScheduleId: detail.workingScheduleId ?? undefined,
      employeeType: detail.employeeType,
      workLocation: detail.workLocation ?? undefined,
      bankAccount: detail.bankAccount ?? undefined,
      bankName: detail.bankName ?? undefined,
      bankIfsc: detail.bankIfsc ?? undefined,
      joinDate: detail.joinDate?.slice(0, 10) ?? undefined,
      active: detail.active,
    });
  }, [employeeQuery.data, reset]);

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
  const managerOptions = (managersQuery.data?.rows ?? [])
    .filter((employee) => employee.id !== id)
    .map((employee) => ({ value: employee.id, label: employee.fullName }));

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(values);
        void navigate(`/employees/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(values);
      }
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  const counts = employeeQuery.data?.counts;

  return (
    <div>
      <PageHeader
        title={
          isNew ? 'New Employee' : (employeeQuery.data?.fullName ?? 'Employee')
        }
        breadcrumbs={[
          { label: 'Employees', to: '/employees' },
          { label: isNew ? 'New' : (employeeQuery.data?.fullName ?? '...') },
        ]}
      />

      {employeeQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this employee. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/employees');
        }}
        error={formError}
        header={
          !isNew && counts !== undefined ? (
            <div className="flex flex-wrap gap-3">
              <SmartButton
                label="Contracts"
                count={counts.contracts}
                to={`/contracts?employeeId=${id}`}
                tone="accent"
              />
              <SmartButton
                label="Attendance"
                count={counts.attendance}
                to={`/attendance?employeeId=${id}`}
                tone="teal"
              />
              <SmartButton
                label="Time Off"
                count={counts.timeOff}
                to={`/time-off/requests?employeeId=${id}`}
                tone="info"
              />
            </div>
          ) : undefined
        }
      >
        <Tabs
          className="mb-4"
          tabs={[
            { key: 'work', label: 'Work Information' },
            { key: 'private', label: 'Private Information' },
          ]}
          active={tab}
          onChange={(key) => {
            setTab(key as FormTab);
          }}
        />

        {tab === 'work' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Employee Code"
              htmlFor="code"
              required
              error={errors.code?.message}
            >
              <Input id="code" {...register('code')} />
            </Field>
            <Field
              label="Work Email"
              htmlFor="workEmail"
              required
              error={errors.workEmail?.message}
            >
              <Input id="workEmail" type="email" {...register('workEmail')} />
            </Field>
            <Field
              label="First Name"
              htmlFor="firstName"
              required
              error={errors.firstName?.message}
            >
              <Input id="firstName" {...register('firstName')} />
            </Field>
            <Field
              label="Last Name"
              htmlFor="lastName"
              required
              error={errors.lastName?.message}
            >
              <Input id="lastName" {...register('lastName')} />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" {...register('phone')} />
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
              label="Manager"
              htmlFor="managerId"
              error={errors.managerId?.message}
            >
              <Select
                id="managerId"
                options={managerOptions}
                placeholder="No manager"
                {...register('managerId', { setValueAs: emptyToUndefined })}
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
              label="Employee Type"
              htmlFor="employeeType"
              error={errors.employeeType?.message}
            >
              <Select
                id="employeeType"
                options={EMPLOYEE_TYPE_OPTIONS}
                {...register('employeeType')}
              />
            </Field>
            <Field
              label="Work Location"
              htmlFor="workLocation"
              error={errors.workLocation?.message}
            >
              <Input id="workLocation" {...register('workLocation')} />
            </Field>
            <Field
              label="Join Date"
              htmlFor="joinDate"
              error={errors.joinDate?.message}
            >
              <Input
                id="joinDate"
                type="date"
                {...register('joinDate', { setValueAs: emptyToUndefined })}
              />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="active" {...register('active')} />
              <label htmlFor="active" className="text-sm">
                Active
              </label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Personal Email"
              htmlFor="personalEmail"
              error={errors.personalEmail?.message}
            >
              <Input
                id="personalEmail"
                type="email"
                {...register('personalEmail', { setValueAs: emptyToUndefined })}
              />
            </Field>
            <Field
              label="Bank Name"
              htmlFor="bankName"
              error={errors.bankName?.message}
            >
              <Input id="bankName" {...register('bankName')} />
            </Field>
            <Field
              label="Bank Account"
              htmlFor="bankAccount"
              error={errors.bankAccount?.message}
            >
              <Input
                id="bankAccount"
                className="font-mono"
                {...register('bankAccount')}
              />
            </Field>
            <Field
              label="Bank IFSC"
              htmlFor="bankIfsc"
              error={errors.bankIfsc?.message}
            >
              <Input
                id="bankIfsc"
                className="font-mono"
                {...register('bankIfsc')}
              />
            </Field>
          </div>
        )}
      </FormShell>
    </div>
  );
}
