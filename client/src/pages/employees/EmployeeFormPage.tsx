import {
  employeeSchema,
  employeeSelfSchema,
  EMPLOYEE_TYPES,
  type EmployeeInput,
  type EmployeeType,
} from '@payz/shared';
import { useEffect, useState, type ReactNode } from 'react';
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
import { useJobPositionOptions } from '../../api/jobPositions.js';
import { useWorkingSchedules } from '../../api/workingSchedules.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { SmartButton } from '../../components/data/SmartButton.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Tabs } from '../../components/ui/Tabs.js';
import { useAuth } from '../../lib/auth.js';
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

/**
 * What this screen is for the person looking at it.
 *
 * - `hr`   — HR administers the record: every field, plus create.
 * - `self` — the employee corrects their own contact and bank details, and
 *            reads the rest.
 * - `view` — read-only throughout.
 *
 * The three modes exist because "can this person open the page" and "which
 * fields may they change" are different questions, and the second one has no
 * answer if the form is built as all-or-nothing.
 */
type Access = 'hr' | 'self' | 'view';

/**
 * A field the current role may not change, printed as the value it holds.
 *
 * Read-only text rather than a disabled input: a greyed-out box invites
 * someone to try, and a value they are simply being told is not a control
 * that has been switched off.
 */
function ReadOnlyField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

/** An absent optional value, shown as absent rather than as an empty line. */
function orDash(value: string | null | undefined): string {
  return value === null || value === undefined || value === ''
    ? '\u2014'
    : value;
}

export function EmployeeFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { allowed, user } = useAuth();

  // HR administers anyone's record; everybody else gets their own, and only
  // the handful of fields on it that describe them rather than their
  // employment. The API applies the same split (it parses a self update with
  // employeeSelfSchema), so a tampered payload changes nothing extra.
  const canAdminister = allowed(isNew ? 'create' : 'update', 'employee');
  const isOwnRecord = !isNew && user?.employeeId === id;
  const access: Access = canAdminister ? 'hr' : isOwnRecord ? 'self' : 'view';

  const [tab, setTab] = useState<FormTab>('work');
  const [formError, setFormError] = useState<string | null>(null);

  const employeeQuery = useEmployee(isNew ? undefined : id);

  // The pickers exist to change a value. Nobody but HR can, so for everyone
  // else these four lists are not fetched at all -- which matters beyond
  // tidiness: an employee has no permission to list their colleagues as
  // manager options, and asking would answer 403 behind a form that looked
  // like it was still loading.
  const wantsOptions = access === 'hr';
  const departmentsQuery = useDepartments({ pageSize: 200 }, wantsOptions);
  const jobPositionsQuery = useJobPositionOptions(wantsOptions);
  const schedulesQuery = useWorkingSchedules({ pageSize: 200 }, wantsOptions);
  const managersQuery = useEmployees({ pageSize: 200 }, wantsOptions);

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
      } else if (access === 'self') {
        // Send only what this caller may change. The API would drop the rest
        // anyway; sending it would mean quietly posting a department and a
        // job position back on every save, which is a different record than
        // the one the person edited.
        await updateMutation.mutateAsync(employeeSelfSchema.parse(values));
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
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
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
        readOnly={access === 'view'}
        readOnlyNote="Employee records are maintained by HR."
        saveLabel={access === 'self' ? 'Save my details' : 'Save'}
        header={
          !isNew && counts !== undefined ? (
            <div className="flex flex-wrap gap-3">
              {/* Contracts are HR's to read (the matrix puts them at
                  HR_MANAGER), so for anyone else this counted records they
                  would be refused on arrival. A button to a door that does
                  not open is worse than no button. */}
              {allowed('read', 'contract') && (
                <SmartButton
                  label="Contracts"
                  count={counts.contracts}
                  to={`/contracts?employeeId=${id}`}
                  tone="accent"
                />
              )}
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
              {/* B2.2 lists four related records, not three: the leave balance
                  an employee holds is a different question from the leave they
                  have asked for. */}
              <SmartButton
                label="Allocations"
                count={counts.allocations}
                to={`/time-off/allocations?employeeId=${id}`}
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
          access === 'hr' ? (
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
              <Field
                label="Phone"
                htmlFor="phone"
                error={errors.phone?.message}
              >
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
                  {...register('jobPositionId', {
                    setValueAs: emptyToUndefined,
                  })}
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
                  {...register('departmentId', {
                    setValueAs: emptyToUndefined,
                  })}
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
            /* Everyone else reads their employment rather than editing it.
               Where HR gets a picker, this shows the name the picker would
               have selected -- there is no id to resolve and no option list
               to fetch. Phone is the exception: it is the one work-tab field
               that describes the person rather than the job, so its owner
               keeps it. */
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Employee Code">
                <span className="font-mono">
                  {orDash(employeeQuery.data?.code)}
                </span>
              </ReadOnlyField>
              <ReadOnlyField label="Work Email">
                {orDash(employeeQuery.data?.workEmail)}
              </ReadOnlyField>
              <ReadOnlyField label="First Name">
                {orDash(employeeQuery.data?.firstName)}
              </ReadOnlyField>
              <ReadOnlyField label="Last Name">
                {orDash(employeeQuery.data?.lastName)}
              </ReadOnlyField>
              {access === 'self' ? (
                <Field
                  label="Phone"
                  htmlFor="phone"
                  error={errors.phone?.message}
                >
                  <Input id="phone" {...register('phone')} />
                </Field>
              ) : (
                <ReadOnlyField label="Phone">
                  {orDash(employeeQuery.data?.phone)}
                </ReadOnlyField>
              )}
              <ReadOnlyField label="Job Position">
                {orDash(employeeQuery.data?.jobPositionTitle)}
              </ReadOnlyField>
              <ReadOnlyField label="Department">
                {orDash(employeeQuery.data?.departmentName)}
              </ReadOnlyField>
              <ReadOnlyField label="Manager">
                {orDash(employeeQuery.data?.managerName)}
              </ReadOnlyField>
              <ReadOnlyField label="Working Schedule">
                {orDash(employeeQuery.data?.scheduleName)}
              </ReadOnlyField>
              <ReadOnlyField label="Employee Type">
                {orDash(
                  EMPLOYEE_TYPE_OPTIONS.find(
                    (option) =>
                      option.value === employeeQuery.data?.employeeType,
                  )?.label,
                )}
              </ReadOnlyField>
              <ReadOnlyField label="Work Location">
                {orDash(employeeQuery.data?.workLocation)}
              </ReadOnlyField>
              <ReadOnlyField label="Join Date">
                {orDash(employeeQuery.data?.joinDate?.slice(0, 10))}
              </ReadOnlyField>
            </div>
          )
        ) : (
          /* The private tab is the employee's own to keep current, whether
             they are looking at it or HR is. Missing bank details hold up
             their pay (rule W7), so the person who can actually supply them
             is not made to file a ticket for it. */
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
