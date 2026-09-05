import {
  WEEKDAY_LABELS,
  WEEKDAYS,
  workingScheduleSchema,
  type Weekday,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateWorkingSchedule,
  useUpdateWorkingSchedule,
  useWorkingSchedule,
} from '../../api/workingSchedules.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';

interface DayLineFormValue {
  dayOfWeek: Weekday;
  enabled: boolean;
  start: string;
  end: string;
  breakMinutes: number;
}

interface WorkingScheduleFormValues {
  name: string;
  calendarType: string;
  timezone: string;
  active: boolean;
  days: DayLineFormValue[];
}

const DEFAULT_DAYS: DayLineFormValue[] = WEEKDAYS.map((dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek !== 'SATURDAY' && dayOfWeek !== 'SUNDAY',
  start: '09:00',
  end: '18:00',
  breakMinutes: 60,
}));

const EMPTY_VALUES: WorkingScheduleFormValues = {
  name: '',
  calendarType: 'Standard',
  timezone: 'Asia/Kolkata',
  active: true,
  days: DEFAULT_DAYS,
};

/** "HH:MM" -> minutes from midnight, or undefined if the input isn't a full time yet. */
function timeToMinutes(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) {
    return undefined;
  }
  const hoursText = match[1];
  const minutesText = match[2];
  if (hoursText === undefined || minutesText === undefined) {
    return undefined;
  }
  return Number(hoursText) * 60 + Number(minutesText);
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Derived hours for one line. Never stored — recomputed from the inputs. */
function lineHours(line: DayLineFormValue): number {
  if (!line.enabled) {
    return 0;
  }
  const start = timeToMinutes(line.start);
  const end = timeToMinutes(line.end);
  if (start === undefined || end === undefined || end <= start) {
    return 0;
  }
  const worked = end - start - line.breakMinutes;
  return worked > 0 ? worked / 60 : 0;
}

export function WorkingScheduleFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();

  const [formError, setFormError] = useState<string | null>(null);

  const scheduleQuery = useWorkingSchedule(isNew ? undefined : id);
  const createMutation = useCreateWorkingSchedule();
  const updateMutation = useUpdateWorkingSchedule(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<WorkingScheduleFormValues>({
    defaultValues: EMPTY_VALUES,
  });

  const { fields } = useFieldArray({ control, name: 'days' });
  const watchedDays = useWatch({ control, name: 'days' });

  useEffect(() => {
    if (scheduleQuery.data === undefined) {
      return;
    }
    const detail = scheduleQuery.data;
    const lineByDay = new Map((detail.lines ?? []).map((line) => [line.dayOfWeek, line]));
    reset({
      name: detail.name,
      calendarType: detail.calendarType,
      timezone: detail.timezone,
      active: detail.active,
      days: WEEKDAYS.map((dayOfWeek) => {
        const line = lineByDay.get(dayOfWeek);
        if (line === undefined) {
          const fallback = DEFAULT_DAYS.find((d) => d.dayOfWeek === dayOfWeek);
          return {
            dayOfWeek,
            enabled: false,
            start: fallback?.start ?? '09:00',
            end: fallback?.end ?? '18:00',
            breakMinutes: fallback?.breakMinutes ?? 60,
          };
        }
        return {
          dayOfWeek,
          enabled: true,
          start: minutesToTime(line.startMinute),
          end: minutesToTime(line.endMinute),
          breakMinutes: line.breakMinutes,
        };
      }),
    });
  }, [scheduleQuery.data, reset]);

  const totalWeeklyHours = watchedDays.reduce(
    (sum, day) => sum + lineHours(day),
    0,
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const lines = values.days
      .filter((day) => day.enabled)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        startMinute: timeToMinutes(day.start) ?? 0,
        endMinute: timeToMinutes(day.end) ?? 0,
        breakMinutes: day.breakMinutes,
      }));

    const parsed = workingScheduleSchema.safeParse({
      name: values.name,
      calendarType: values.calendarType,
      timezone: values.timezone,
      active: values.active,
      lines,
    });

    if (!parsed.success) {
      const enabledDays = values.days
        .filter((day) => day.enabled)
        .map((day) => day.dayOfWeek);
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'name') {
        setError('name', { message: issue.message });
      }
      if (issue !== undefined) {
        const dayIndex = issue.path[1];
        const day =
          issue.path[0] === 'lines' && typeof dayIndex === 'number'
            ? enabledDays[dayIndex]
            : undefined;
        setFormError(
          day !== undefined
            ? `${WEEKDAY_LABELS[day]}: ${issue.message}`
            : issue.message,
        );
      }
      return;
    }

    try {
      if (isNew) {
        await createMutation.mutateAsync(parsed.data);
      } else {
        await updateMutation.mutateAsync(parsed.data);
      }
      void navigate('/working-schedules');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Working Schedule' : (scheduleQuery.data?.name ?? 'Working Schedule')}
        breadcrumbs={[
          { label: 'Working Schedules', to: '/working-schedules' },
          { label: isNew ? 'New' : (scheduleQuery.data?.name ?? '...') },
        ]}
      />

      {scheduleQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this schedule. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/working-schedules');
        }}
        error={formError}
      >
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Schedule Name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" {...register('name', { required: 'Schedule name is required' })} />
          </Field>
          <Field label="Calendar Type" htmlFor="calendarType">
            <Input id="calendarType" {...register('calendarType')} />
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Input id="timezone" {...register('timezone')} />
          </Field>
        </div>

        <div className="border-line overflow-hidden rounded-lg border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface border-line border-b">
              <tr>
                <th className="text-muted w-10 px-3 py-2" />
                <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  Day
                </th>
                <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  Start
                </th>
                <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  End
                </th>
                <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  Break (min)
                </th>
                <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                  Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const watched = watchedDays[index];
                const enabled = watched?.enabled ?? field.enabled;
                return (
                  <tr key={field.id} className="border-line border-b last:border-0">
                    <td className="px-3 py-2">
                      <Checkbox {...register(`days.${index}.enabled`)} />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {WEEKDAY_LABELS[field.dayOfWeek]}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        disabled={!enabled}
                        className="max-w-32"
                        {...register(`days.${index}.start`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        disabled={!enabled}
                        className="max-w-32"
                        {...register(`days.${index}.end`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        disabled={!enabled}
                        className="max-w-24 font-mono"
                        {...register(`days.${index}.breakMinutes`, {
                          valueAsNumber: true,
                        })}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {watched !== undefined ? lineHours(watched).toFixed(2) : '0.00'}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-info-soft text-info mt-4 flex items-center justify-between rounded-md px-4 py-2.5">
          <span className="text-sm font-medium">Total Weekly Hours</span>
          <span className="font-mono text-lg font-bold">
            {totalWeeklyHours.toFixed(2)}h
          </span>
        </div>

        <div className="flex items-center gap-2 pt-4">
          <Checkbox id="active" {...register('active')} />
          <label htmlFor="active" className="text-sm">
            Active
          </label>
        </div>
      </FormShell>
    </div>
  );
}
