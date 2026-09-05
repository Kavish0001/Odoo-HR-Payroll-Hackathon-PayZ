import { attendanceSchema, type AttendanceInput } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  useAttendanceRecord,
  useCreateAttendance,
  useUpdateAttendance,
} from '../../api/attendance.js';
import { toApiError } from '../../api/client.js';
import { useEmployees } from '../../api/employees.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuth } from '../../lib/auth.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface AttendanceFormValues {
  employeeId: string;
  checkIn: string;
  checkOut?: string | undefined;
  notes?: string | undefined;
}

const EMPTY_VALUES = (employeeId?: string): AttendanceFormValues => ({
  employeeId: employeeId ?? '',
  checkIn: '',
  checkOut: undefined,
  notes: undefined,
});

/** `datetime-local` accepts (and this codebase renders) naive `YYYY-MM-DDTHH:mm`. */
function toDateTimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

export function AttendanceFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillEmployeeId = searchParams.get('employeeId') ?? undefined;
  const { allowed } = useAuth();

  // Rule A5: manual create/edit is restricted to HR_MANAGER+. The matrix has
  // no separate action for "manual create", so this reuses the same rank the
  // matrix already requires for 'update' on attendance.
  const canEdit = allowed('update', 'attendance');

  const [formError, setFormError] = useState<string | null>(null);

  const attendanceQuery = useAttendanceRecord(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });

  const createMutation = useCreateAttendance();
  const updateMutation = useUpdateAttendance(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AttendanceFormValues, unknown, AttendanceInput>({
    resolver: typedZodResolver<AttendanceFormValues, AttendanceInput>(
      attendanceSchema,
    ),
    defaultValues: EMPTY_VALUES(prefillEmployeeId),
  });

  useEffect(() => {
    if (attendanceQuery.data === undefined) {
      return;
    }
    const detail = attendanceQuery.data;
    reset({
      employeeId: detail.employeeId,
      checkIn: toDateTimeLocal(detail.checkIn),
      checkOut:
        detail.checkOut !== null ? toDateTimeLocal(detail.checkOut) : undefined,
      notes: detail.notes ?? undefined,
    });
  }, [attendanceQuery.data, reset]);

  const employeeOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));

  const backTarget =
    prefillEmployeeId !== undefined
      ? `/attendance?employeeId=${prefillEmployeeId}`
      : '/attendance';

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

  const detail = attendanceQuery.data;

  return (
    <div>
      <PageHeader
        title={
          isNew
            ? 'New Attendance Record'
            : (detail?.employeeName ?? 'Attendance')
        }
        breadcrumbs={[
          { label: 'Attendance', to: '/attendance' },
          { label: isNew ? 'New' : (detail?.employeeName ?? '...') },
        ]}
      />

      {attendanceQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this attendance record. The API may still be starting
          up.
        </p>
      )}

      {!canEdit && (
        <p className="border-line bg-surface text-muted mb-4 rounded-md border px-3 py-2 text-sm">
          You have read-only access to attendance records. Ask an HR Manager to
          make changes.
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
        disableSave={!canEdit}
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
              disabled={!canEdit || prefillEmployeeId !== undefined}
              {...register('employeeId')}
            />
          </Field>

          {!isNew && detail !== undefined && (
            <Field label="Status" htmlFor="status-display">
              <div id="status-display" className="flex items-center gap-2 py-2">
                <StatusBadge status={detail.status} />
                <span className="text-muted text-xs">
                  {detail.manuallyEdited
                    ? 'Manually edited'
                    : `Source: ${detail.source}`}
                </span>
              </div>
            </Field>
          )}

          <Field
            label="Check In"
            htmlFor="checkIn"
            required
            error={errors.checkIn?.message}
          >
            <Input
              id="checkIn"
              type="datetime-local"
              disabled={!canEdit}
              className="font-mono"
              {...register('checkIn')}
            />
          </Field>
          <Field
            label="Check Out"
            htmlFor="checkOut"
            hint="Leave empty for an open session."
            error={errors.checkOut?.message}
          >
            <Input
              id="checkOut"
              type="datetime-local"
              disabled={!canEdit}
              className="font-mono"
              {...register('checkOut', { setValueAs: emptyToUndefined })}
            />
          </Field>

          {!isNew && detail !== undefined && (
            <>
              <Field label="Worked Hours" htmlFor="workedHours-display">
                <div
                  id="workedHours-display"
                  className="font-mono py-2 text-sm"
                >
                  {detail.workedHours.toFixed(2)}
                </div>
              </Field>
              <Field label="Overtime Hours" htmlFor="overtimeHours-display">
                <div
                  id="overtimeHours-display"
                  className="font-mono py-2 text-sm"
                >
                  {detail.overtimeHours.toFixed(2)}
                </div>
              </Field>
            </>
          )}

          <Field
            label="Notes"
            htmlFor="notes"
            className="sm:col-span-2"
            error={errors.notes?.message}
          >
            <Textarea
              id="notes"
              rows={3}
              disabled={!canEdit}
              {...register('notes', { setValueAs: emptyToUndefined })}
            />
          </Field>
        </div>
      </FormShell>
    </div>
  );
}
