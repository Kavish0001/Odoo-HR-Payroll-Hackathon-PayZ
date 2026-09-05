import { jobPositionSchema, type JobPositionInput } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateJobPosition,
  useDeleteJobPosition,
  useJobPosition,
  useUpdateJobPosition,
} from '../../api/jobPositions.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';
import { typedZodResolver } from '../../lib/forms.js';

interface JobPositionFormValues {
  title: string;
  active: boolean;
}

const EMPTY_VALUES: JobPositionFormValues = {
  title: '',
  active: true,
};

export function JobPositionFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { allowed } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);

  const positionQuery = useJobPosition(isNew ? undefined : id);

  const createMutation = useCreateJobPosition();
  const updateMutation = useUpdateJobPosition(id);
  const deleteMutation = useDeleteJobPosition();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<JobPositionFormValues, unknown, JobPositionInput>({
    resolver: typedZodResolver<JobPositionFormValues, JobPositionInput>(
      jobPositionSchema,
    ),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (positionQuery.data === undefined) {
      return;
    }
    const detail = positionQuery.data;
    reset({
      title: detail.title,
      active: detail.active,
    });
  }, [positionQuery.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate('/job-positions');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  const onArchive = async (): Promise<void> => {
    setFormError(null);
    try {
      await deleteMutation.mutateAsync(id);
      void navigate('/job-positions');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  };

  const detail = positionQuery.data;
  // DELETE is a soft delete: it only clears `active`, so offering it on an
  // already-inactive position would be a no-op button.
  const canArchive =
    !isNew && allowed('delete', 'jobPosition') && detail?.active === true;

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Job Position' : (detail?.title ?? 'Job Position')}
        breadcrumbs={[
          { label: 'Job Positions', to: '/job-positions' },
          { label: isNew ? 'New' : (detail?.title ?? '...') },
        ]}
        subtitle={
          detail !== undefined
            ? `${String(detail.employeeCount)} employees and ${String(detail.contractCount)} contracts hold this position.`
            : undefined
        }
      />

      {positionQuery.isError && !isNew && (
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
          Could not load this job position. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/job-positions');
        }}
        error={formError}
        footerExtra={
          canArchive ? (
            <Button
              type="button"
              variant="secondary"
              className="text-danger ml-auto"
              onClick={() => {
                void onArchive();
              }}
              disabled={deleteMutation.isPending}
            >
              Archive
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Title"
            htmlFor="title"
            required
            error={errors.title?.message}
          >
            <Input id="title" {...register('title')} />
          </Field>
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
