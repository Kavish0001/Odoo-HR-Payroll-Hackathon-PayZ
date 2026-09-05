import { departmentSchema, type DepartmentInput } from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateDepartment,
  useDepartment,
  useUpdateDepartment,
} from '../../api/departments.js';
import { useEmployees } from '../../api/employees.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { useAuth } from '../../lib/auth.js';
import { emptyToUndefined, typedZodResolver } from '../../lib/forms.js';

interface DepartmentFormValues {
  name: string;
  code?: string | undefined;
  managerId?: string | undefined;
  active: boolean;
}

const EMPTY_VALUES: DepartmentFormValues = {
  name: '',
  code: undefined,
  managerId: undefined,
  active: true,
};

export function DepartmentFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { allowed } = useAuth();
  const navigate = useNavigate();

  // Read on this resource sits at EMPLOYEE so other forms can resolve
  // its names; changing it is HR's. Anyone without the write permission
  // reads the record instead of being handed inputs and a Save button
  // that answers 403.
  const canWrite = allowed(isNew ? 'create' : 'update', 'department');
  const [formError, setFormError] = useState<string | null>(null);

  const departmentQuery = useDepartment(isNew ? undefined : id);
  const employeesQuery = useEmployees({ pageSize: 200 });

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentFormValues, unknown, DepartmentInput>({
    resolver: typedZodResolver<DepartmentFormValues, DepartmentInput>(
      departmentSchema,
    ),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (departmentQuery.data === undefined) {
      return;
    }
    const detail = departmentQuery.data;
    reset({
      name: detail.name,
      code: detail.code ?? undefined,
      managerId: detail.managerId ?? undefined,
      active: detail.active,
    });
  }, [departmentQuery.data, reset]);

  const managerOptions = (employeesQuery.data?.rows ?? []).map((e) => ({
    value: e.id,
    label: e.fullName,
  }));

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        await createMutation.mutateAsync(values);
      } else {
        await updateMutation.mutateAsync(values);
      }
      void navigate('/departments');
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <div>
      <PageHeader
        title={
          isNew
            ? 'New Department'
            : (departmentQuery.data?.name ?? 'Department')
        }
        breadcrumbs={[
          { label: 'Departments', to: '/departments' },
          { label: isNew ? 'New' : (departmentQuery.data?.name ?? '...') },
        ]}
      />

      {departmentQuery.isError && !isNew && (
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
          Could not load this department. The API may still be starting up.
        </p>
      )}

      <FormShell
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        isSubmitting={isSubmitting}
        onDiscard={() => {
          void navigate('/departments');
        }}
        error={formError}
        readOnly={!canWrite}
        readOnlyNote="Departments are maintained by HR."
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
          <Field label="Code" htmlFor="code" error={errors.code?.message}>
            <Input
              id="code"
              className="font-mono"
              {...register('code', { setValueAs: emptyToUndefined })}
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
