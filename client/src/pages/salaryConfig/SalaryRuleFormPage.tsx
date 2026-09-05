import {
  COMPUTATION_TYPE_LABELS,
  COMPUTATION_TYPES,
  formatINR,
  PERCENTAGE_BASES,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  salaryRuleSchema,
  type ComputationType,
  type PercentageBase,
  type RuleCategory,
  type SalaryRuleInput,
} from '@payz/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  useCreateSalaryRule,
  useSalaryRule,
  useSalaryStructures,
  useTestSalaryFormula,
  useUpdateSalaryRule,
  type FormulaPreviewResult,
} from '../../api/salaryConfig.js';
import { FormShell } from '../../components/data/FormShell.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { useAuth } from '../../lib/auth.js';
import {
  emptyToUndefined,
  emptyToUndefinedNumber,
  typedZodResolver,
} from '../../lib/forms.js';

import { CategoryBadge } from './CategoryBadge.js';

interface SalaryRuleFormValues {
  structureId: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  computationType: ComputationType;
  fixedAmount?: number | undefined;
  percentage?: number | undefined;
  percentageBase?: PercentageBase | undefined;
  percentageRuleCode?: string | undefined;
  formula?: string | undefined;
  quantity: number;
  active: boolean;
}

const CATEGORY_OPTIONS = RULE_CATEGORIES.map((value) => ({
  value,
  label: RULE_CATEGORY_LABELS[value],
}));

const COMPUTATION_OPTIONS = COMPUTATION_TYPES.map((value) => ({
  value,
  label: COMPUTATION_TYPE_LABELS[value],
}));

const PERCENTAGE_BASE_LABELS: Record<PercentageBase, string> = {
  CONTRACT_WAGE: 'Contract Wage',
  BASIC: 'Basic',
  GROSS: 'Gross',
  RULE: 'Another Rule',
};
const PERCENTAGE_BASE_OPTIONS = PERCENTAGE_BASES.map((value) => ({
  value,
  label: PERCENTAGE_BASE_LABELS[value],
}));

const EMPTY_VALUES = (structureId?: string): SalaryRuleFormValues => ({
  structureId: structureId ?? '',
  name: '',
  code: '',
  category: 'ALLOWANCE',
  sequence: 10,
  computationType: 'FIXED',
  fixedAmount: undefined,
  percentage: undefined,
  percentageBase: undefined,
  percentageRuleCode: undefined,
  formula: undefined,
  quantity: 1,
  active: true,
});

export function SalaryRuleFormPage(): React.JSX.Element {
  const { id = 'new' } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillStructureId = searchParams.get('structureId') ?? undefined;
  const { allowed } = useAuth();

  const [formError, setFormError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<FormulaPreviewResult | null>(
    null,
  );
  const [sampleWage, setSampleWage] = useState(50000);
  const [sampleWorkedDays, setSampleWorkedDays] = useState(30);
  const [sampleSeniorityYears, setSampleSeniorityYears] = useState(1);

  const ruleQuery = useSalaryRule(isNew ? undefined : id);
  const structuresQuery = useSalaryStructures({ pageSize: 200 });

  const createMutation = useCreateSalaryRule();
  const updateMutation = useUpdateSalaryRule(id);
  const previewMutation = useTestSalaryFormula();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const canWrite = allowed(isNew ? 'create' : 'update', 'salaryRule');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SalaryRuleFormValues, unknown, SalaryRuleInput>({
    resolver: typedZodResolver<SalaryRuleFormValues, SalaryRuleInput>(
      salaryRuleSchema,
    ),
    defaultValues: EMPTY_VALUES(prefillStructureId),
  });

  useEffect(() => {
    if (ruleQuery.data === undefined) {
      return;
    }
    const detail = ruleQuery.data;
    reset({
      structureId: detail.structureId,
      name: detail.name,
      code: detail.code,
      category: detail.category,
      sequence: detail.sequence,
      computationType: detail.computationType,
      fixedAmount:
        detail.fixedAmount !== null ? detail.fixedAmount / 100 : undefined,
      percentage: detail.percentage ?? undefined,
      percentageBase: detail.percentageBase ?? undefined,
      percentageRuleCode: detail.percentageRuleCode ?? undefined,
      formula: detail.formula ?? undefined,
      quantity: detail.quantity,
      active: detail.active,
    });
  }, [ruleQuery.data, reset]);

  const structureOptions = (structuresQuery.data?.rows ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const category = watch('category');
  const computationType = watch('computationType');
  const percentageBase = watch('percentageBase');
  const formula = watch('formula');

  const isTotalCategory = category === 'GROSS' || category === 'NET';

  const currentStructureId = isNew
    ? prefillStructureId
    : (ruleQuery.data?.structureId ?? prefillStructureId);
  const backTarget =
    currentStructureId !== undefined
      ? `/payroll/structures/${currentStructureId}`
      : '/payroll/rules';

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

  const runFormulaTest = async (): Promise<void> => {
    setPreviewResult(null);
    try {
      const result = await previewMutation.mutateAsync({
        formula: formula ?? '',
        wage: sampleWage,
        workedDays: sampleWorkedDays,
        seniorityYears: sampleSeniorityYears,
      });
      setPreviewResult(result);
    } catch (error) {
      setPreviewResult({ ok: false, error: toApiError(error).message });
    }
  };

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Salary Rule' : (ruleQuery.data?.name ?? 'Salary Rule')}
        breadcrumbs={[
          { label: 'Salary Rules', to: '/payroll/rules' },
          { label: isNew ? 'New' : (ruleQuery.data?.name ?? '...') },
        ]}
      />

      {ruleQuery.isError && !isNew && (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          Could not load this salary rule. The API may still be starting up.
        </p>
      )}

      {canWrite ? (
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
              label="Structure"
              htmlFor="structureId"
              required
              error={errors.structureId?.message}
            >
              <Select
                id="structureId"
                options={structureOptions}
                placeholder="Select a structure"
                disabled={prefillStructureId !== undefined}
                {...register('structureId')}
              />
            </Field>
            <Field label="Rule Name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" {...register('name')} />
            </Field>
            <Field label="Code" htmlFor="code" required error={errors.code?.message}>
              <Input id="code" className="font-mono" {...register('code')} />
            </Field>
            <Field label="Category" htmlFor="category" required error={errors.category?.message}>
              <Select id="category" options={CATEGORY_OPTIONS} {...register('category')} />
            </Field>
            <Field
              label="Sequence"
              htmlFor="sequence"
              required
              hint="Determines execution order. Must be unique within the structure."
              error={errors.sequence?.message}
            >
              <Input
                id="sequence"
                type="number"
                className="font-mono"
                {...register('sequence', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                className="font-mono"
                {...register('quantity', { valueAsNumber: true })}
              />
            </Field>

            {isTotalCategory ? (
              <div className="sm:col-span-2">
                <p className="border-line bg-surface text-muted rounded-md border px-3 py-2 text-xs">
                  {category === 'GROSS'
                    ? 'Gross is computed automatically as Basic + Allowances. No further configuration is needed.'
                    : 'Net is computed automatically as Gross + Deductions. No further configuration is needed.'}
                </p>
              </div>
            ) : (
              <>
                <Field
                  label="Computation Type"
                  htmlFor="computationType"
                  required
                  error={errors.computationType?.message}
                >
                  <Select
                    id="computationType"
                    options={COMPUTATION_OPTIONS}
                    {...register('computationType')}
                  />
                </Field>

                {computationType === 'FIXED' && (
                  <Field
                    label="Amount (₹)"
                    htmlFor="fixedAmount"
                    required
                    error={errors.fixedAmount?.message}
                  >
                    <Input
                      id="fixedAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      className="font-mono"
                      {...register('fixedAmount', {
                        setValueAs: emptyToUndefinedNumber,
                      })}
                    />
                  </Field>
                )}

                {computationType === 'PERCENTAGE' && (
                  <>
                    <Field
                      label="Percentage"
                      htmlFor="percentage"
                      required
                      error={errors.percentage?.message}
                    >
                      <Input
                        id="percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="font-mono"
                        {...register('percentage', {
                          setValueAs: emptyToUndefinedNumber,
                        })}
                      />
                    </Field>
                    <Field
                      label="Percentage Of"
                      htmlFor="percentageBase"
                      required
                      error={errors.percentageBase?.message}
                    >
                      <Select
                        id="percentageBase"
                        options={PERCENTAGE_BASE_OPTIONS}
                        placeholder="Select a base"
                        {...register('percentageBase', {
                          setValueAs: emptyToUndefined,
                        })}
                      />
                    </Field>
                    {percentageBase === 'RULE' && (
                      <Field
                        label="Rule Code"
                        htmlFor="percentageRuleCode"
                        required
                        hint="The code of the rule to take a percentage of."
                        error={errors.percentageRuleCode?.message}
                      >
                        <Input
                          id="percentageRuleCode"
                          className="font-mono"
                          {...register('percentageRuleCode', {
                            setValueAs: emptyToUndefined,
                          })}
                        />
                      </Field>
                    )}
                  </>
                )}

                {computationType === 'FORMULA' && (
                  <div className="sm:col-span-2">
                    <Field
                      label="Formula"
                      htmlFor="formula"
                      required
                      hint="Available: rules['CODE'], categories['BASIC'|'ALLOWANCE'|'GROSS'|'DEDUCTION'|'NET'], contract.wage, worked.days, employee.seniorityYears."
                      error={errors.formula?.message}
                    >
                      <Textarea
                        id="formula"
                        rows={4}
                        className="font-mono"
                        {...register('formula', {
                          setValueAs: emptyToUndefined,
                        })}
                      />
                    </Field>

                    <div className="border-line bg-surface mt-3 rounded-md border p-3">
                      <p className="text-muted mb-2 text-xs font-medium tracking-wide uppercase">
                        Test formula
                      </p>
                      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Field label="Sample Wage (₹)">
                          <Input
                            type="number"
                            className="font-mono"
                            value={sampleWage}
                            onChange={(event) => {
                              setSampleWage(Number(event.target.value));
                            }}
                          />
                        </Field>
                        <Field label="Worked Days">
                          <Input
                            type="number"
                            className="font-mono"
                            value={sampleWorkedDays}
                            onChange={(event) => {
                              setSampleWorkedDays(Number(event.target.value));
                            }}
                          />
                        </Field>
                        <Field label="Seniority (yrs)">
                          <Input
                            type="number"
                            className="font-mono"
                            value={sampleSeniorityYears}
                            onChange={(event) => {
                              setSampleSeniorityYears(Number(event.target.value));
                            }}
                          />
                        </Field>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          previewMutation.isPending ||
                          formula === undefined ||
                          formula.trim().length === 0
                        }
                        onClick={() => {
                          void runFormulaTest();
                        }}
                      >
                        {previewMutation.isPending ? 'Testing…' : 'Test formula'}
                      </Button>
                      {previewResult !== null &&
                        (previewResult.ok ? (
                          <p className="text-success mt-2 font-mono text-sm">
                            Result: {formatINR(previewResult.amount)}
                          </p>
                        ) : (
                          <p className="text-danger mt-2 text-sm">
                            {previewResult.error}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

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
            <Field label="Structure">
              <p className="text-sm">
                {structureOptions.find((o) => o.value === ruleQuery.data?.structureId)
                  ?.label ?? ruleQuery.data?.structureName ?? '—'}
              </p>
            </Field>
            <Field label="Rule Name">
              <p className="text-sm">{ruleQuery.data?.name ?? '—'}</p>
            </Field>
            <Field label="Code">
              <p className="font-mono text-sm">{ruleQuery.data?.code ?? '—'}</p>
            </Field>
            <Field label="Category">
              {ruleQuery.data !== undefined ? (
                <CategoryBadge category={ruleQuery.data.category} />
              ) : (
                <p className="text-sm">—</p>
              )}
            </Field>
            <Field label="Sequence">
              <p className="font-mono text-sm">{ruleQuery.data?.sequence ?? '—'}</p>
            </Field>
            <Field label="Computation Type">
              <p className="text-sm">
                {ruleQuery.data !== undefined
                  ? COMPUTATION_TYPE_LABELS[ruleQuery.data.computationType]
                  : '—'}
              </p>
            </Field>
            {ruleQuery.data?.computationType === 'FIXED' && (
              <Field label="Amount">
                <p className="font-mono text-sm">
                  {ruleQuery.data.fixedAmount !== null
                    ? formatINR(ruleQuery.data.fixedAmount)
                    : '—'}
                </p>
              </Field>
            )}
            {ruleQuery.data?.computationType === 'PERCENTAGE' && (
              <Field label="Percentage">
                <p className="font-mono text-sm">
                  {ruleQuery.data.percentage ?? '—'}% of{' '}
                  {ruleQuery.data.percentageBase ?? '—'}
                  {ruleQuery.data.percentageBase === 'RULE'
                    ? ` (${ruleQuery.data.percentageRuleCode ?? '—'})`
                    : ''}
                </p>
              </Field>
            )}
            {ruleQuery.data?.computationType === 'FORMULA' && (
              <div className="sm:col-span-2">
                <Field label="Formula">
                  <pre className="border-line bg-surface overflow-x-auto rounded-md border p-3 font-mono text-xs">
                    {ruleQuery.data.formula ?? '—'}
                  </pre>
                </Field>
              </div>
            )}
            <Field label="Active">
              <StatusBadge
                status={ruleQuery.data?.active ? 'ACTIVE' : 'INACTIVE'}
                dot
              />
            </Field>
          </div>
        </Card>
      )}
    </div>
  );
}
