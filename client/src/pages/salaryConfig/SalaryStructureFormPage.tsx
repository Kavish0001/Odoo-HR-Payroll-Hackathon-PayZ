import {
  salaryStructureSchema,
  type SalaryRuleRow,
  type SalaryStructureInput,
} from '@payz/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateSalaryStructure,
  useSalaryStructure,
  useUpdateSalaryStructure,
} from '../../api/salaryConfig.js';
import { DataTable } from '../../components/data/DataTable.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../lib/auth.js';
import { typedZodResolver } from '../../lib/forms.js';

import { CategoryBadge } from './CategoryBadge.js';

interface SalaryStructureFormValues {
  name: string;
  code: string;
  active: boolean;
}

const EMPTY_VALUES: SalaryStructureFormValues = {
  name: '',
  code: '',
  active: true,
};

export function SalaryStructureFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { allowed } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);

  const structureQuery = useSalaryStructure(isNew ? undefined : id);
  const createMutation = useCreateSalaryStructure();
  const updateMutation = useUpdateSalaryStructure(id);
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const canWrite = allowed(isNew ? 'create' : 'update', 'salaryStructure');
  const canAddRule = allowed('create', 'salaryRule');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SalaryStructureFormValues, unknown, SalaryStructureInput>({
    resolver: typedZodResolver<SalaryStructureFormValues, SalaryStructureInput>(
      salaryStructureSchema,
    ),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (structureQuery.data === undefined) {
      return;
    }
    reset({
      name: structureQuery.data.name,
      code: structureQuery.data.code,
      active: structureQuery.data.active,
    });
  }, [structureQuery.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync(values);
        void navigate(`/payroll/structures/${created.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync(values);
      }
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  const rules = structureQuery.data?.rules ?? [];

  const ruleColumns = useMemo<ColumnDef<SalaryRuleRow>[]>(
    () => [
      { id: 'name', header: 'Name', accessorKey: 'name' },
      {
        id: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.code}</span>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      },
      {
        id: 'sequence',
        header: 'Sequence',
        accessorKey: 'sequence',
        cell: ({ row }) => (
          <span className="font-mono">{row.original.sequence}</span>
        ),
      },
    ],
    [],
  );

  const rulesSection =
    !isNew && structureQuery.data !== undefined ? (
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Rules
          </h2>
          {canAddRule && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigate(`/payroll/rules/new?structureId=${id}`);
              }}
            >
              Add Rule
            </Button>
          )}
        </div>
        <DataTable
          columns={ruleColumns}
          data={rules}
          emptyTitle="No rules yet"
          emptyDescription="Add a rule to start building this structure's payslip."
          onRowClick={(row) => {
            void navigate(`/payroll/rules/${row.id}`);
          }}
          getRowId={(row) => row.id}
        />
      </div>
    ) : null;

  return (
    <div>
      <PageHeader
        title={
          isNew
            ? 'New Salary Structure'
            : (structureQuery.data?.name ?? 'Salary Structure')
        }
        breadcrumbs={[
          { label: 'Salary Structures', to: '/payroll/structures' },
          { label: isNew ? 'New' : (structureQuery.data?.name ?? '...') },
        ]}
      />

      {structureQuery.isError && !isNew && (
        <p className="border-danger-line bg-danger-soft text-ink mb-4 rounded-sm border px-3 py-2 text-sm">
          Could not load this salary structure. The API may still be starting
          up.
        </p>
      )}

      {canWrite ? (
        <FormShell
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          isSubmitting={isSubmitting}
          onDiscard={() => {
            void navigate('/payroll/structures');
          }}
          error={formError}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Structure Name"
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
              <Input id="code" className="font-mono" {...register('code')} />
            </Field>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="active" {...register('active')} />
              <label htmlFor="active" className="text-sm">
                Active
              </label>
            </div>
          </div>
        </FormShell>
      ) : (
        <Card className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Structure Name">
              <p className="text-sm">{structureQuery.data?.name ?? '—'}</p>
            </Field>
            <Field label="Code">
              <p className="font-mono text-sm">
                {structureQuery.data?.code ?? '—'}
              </p>
            </Field>
            <Field label="Active">
              <StatusBadge
                status={structureQuery.data?.active ? 'ACTIVE' : 'INACTIVE'}
                dot
              />
            </Field>
          </div>
        </Card>
      )}

      {rulesSection}
    </div>
  );
}
