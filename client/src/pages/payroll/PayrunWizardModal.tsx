import { EMPLOYEE_TYPES, formatINR, type EmployeeType } from '@payz/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import {
  EMPLOYEE_TYPE_LABELS,
  useCreatePayrun,
  usePreviewEligible,
  useSalaryStructureOptions,
  type ExcludedEmployee,
} from '../../api/payruns.js';
import { Button } from '../../components/ui/Button.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';

/**
 * The two-step payrun wizard, rendered as a modal over the payruns list.
 *
 * Step one only ever calls `preview-eligible`, which has no write path at
 * all (rule W1) — Continue advances a step in this component's own state
 * and nothing else. The payrun is created exactly once, when "Create
 * Payrun" on step two submits the checked `employeeIds` (rule W2).
 */

type WizardStep = 'scope' | 'select';

interface ScopeState {
  employeeTypeScope: EmployeeType | '';
  salaryStructureId: string;
  periodStart: string;
  periodEnd: string;
}

const EMPTY_SCOPE: ScopeState = {
  employeeTypeScope: '',
  salaryStructureId: '',
  periodStart: '',
  periodEnd: '',
};

export function PayrunWizardModal(): React.JSX.Element {
  const navigate = useNavigate();
  const structuresQuery = useSalaryStructureOptions();
  const previewMutation = usePreviewEligible();
  const createMutation = useCreatePayrun();

  const [step, setStep] = useState<WizardStep>('scope');
  const [scope, setScope] = useState<ScopeState>(EMPTY_SCOPE);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<ExcludedEmployee[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const eligible = previewMutation.data?.eligible ?? [];

  function close(): void {
    void navigate('/payroll/payruns');
  }

  function toggle(employeeId: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }

  function toggleAll(): void {
    setSelected((prev) =>
      prev.size === eligible.length
        ? new Set()
        : new Set(eligible.map((e) => e.employeeId)),
    );
  }

  const onContinue = async (): Promise<void> => {
    setScopeError(null);

    if (
      scope.salaryStructureId === '' ||
      scope.periodStart === '' ||
      scope.periodEnd === ''
    ) {
      setScopeError('Salary structure and both period dates are required.');
      return;
    }
    if (scope.periodEnd < scope.periodStart) {
      setScopeError('Period end cannot be before its start.');
      return;
    }

    try {
      // Continue only ever calls the read-only preview-eligible endpoint and
      // moves this modal to step 2 (rule W1). It never calls POST /payruns —
      // that only happens from "Create Payrun" on step two, below.
      const result = await previewMutation.mutateAsync({
        salaryStructureId: scope.salaryStructureId,
        periodStart: scope.periodStart,
        periodEnd: scope.periodEnd,
        employeeTypeScope:
          scope.employeeTypeScope === '' ? undefined : scope.employeeTypeScope,
      });
      setExcluded(result.excluded);
      setSelected(new Set(result.eligible.map((e) => e.employeeId)));
      setStep('select');
    } catch (error) {
      setScopeError(toApiError(error).message);
    }
  };

  const onCreate = async (): Promise<void> => {
    setCreateError(null);
    if (name.trim().length === 0) {
      setCreateError('Give this payrun a name.');
      return;
    }
    if (selected.size === 0) {
      setCreateError('Select at least one employee.');
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        salaryStructureId: scope.salaryStructureId,
        periodStart: scope.periodStart,
        periodEnd: scope.periodEnd,
        employeeTypeScope:
          scope.employeeTypeScope === '' ? undefined : scope.employeeTypeScope,
        name: name.trim(),
        employeeIds: [...selected],
      });
      void navigate(`/payroll/payruns/${created.id}`);
    } catch (error) {
      setCreateError(toApiError(error).message);
    }
  };

  const structureOptions = (structuresQuery.data ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const typeOptions = EMPLOYEE_TYPES.map((type) => ({
    value: type,
    label: EMPLOYEE_TYPE_LABELS[type],
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-metal-900/40 p-4">
      <div className="bg-raised border-line max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border shadow-xl">
        <div className="border-line flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {step === 'scope' ? 'New Pay Run' : 'Select Employee Records'}
            </h2>
            <p className="text-muted text-xs">
              Step {step === 'scope' ? '1' : '2'} of 2
            </p>
          </div>
        </div>

        {step === 'scope' && (
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Employee Type" htmlFor="employeeTypeScope">
                <Select
                  id="employeeTypeScope"
                  options={typeOptions}
                  placeholder="All employee types"
                  value={scope.employeeTypeScope}
                  onChange={(event) => {
                    setScope((prev) => ({
                      ...prev,
                      employeeTypeScope: event.target.value as
                        EmployeeType | '',
                    }));
                  }}
                />
              </Field>
              <Field
                label="Salary Structure"
                htmlFor="salaryStructureId"
                required
              >
                <Select
                  id="salaryStructureId"
                  options={structureOptions}
                  placeholder={
                    structuresQuery.isLoading
                      ? 'Loading…'
                      : 'Select a structure'
                  }
                  value={scope.salaryStructureId}
                  onChange={(event) => {
                    setScope((prev) => ({
                      ...prev,
                      salaryStructureId: event.target.value,
                    }));
                  }}
                />
              </Field>
              <Field label="Period Start" htmlFor="periodStart" required>
                <Input
                  id="periodStart"
                  type="date"
                  value={scope.periodStart}
                  onChange={(event) => {
                    setScope((prev) => ({
                      ...prev,
                      periodStart: event.target.value,
                    }));
                  }}
                />
              </Field>
              <Field label="Period End" htmlFor="periodEnd" required>
                <Input
                  id="periodEnd"
                  type="date"
                  value={scope.periodEnd}
                  onChange={(event) => {
                    setScope((prev) => ({
                      ...prev,
                      periodEnd: event.target.value,
                    }));
                  }}
                />
              </Field>
            </div>

            {scopeError !== null && (
              <p className="border-danger-line bg-danger-soft text-ink rounded-sm border px-3 py-2 text-sm">
                {scopeError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  void onContinue();
                }}
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending ? 'Checking…' : 'Continue'}
              </Button>
              <Button variant="secondary" onClick={close}>
                Discard
              </Button>
            </div>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-4 p-5">
            <Field label="Payrun Name" htmlFor="payrunName" required>
              <Input
                id="payrunName"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder="e.g. September 2026"
              />
            </Field>

            {excluded.length > 0 && (
              <p className="border-warning-line bg-warning-soft text-warning-strong rounded-md border px-3 py-2 text-xs">
                {excluded.length} employee{excluded.length === 1 ? '' : 's'}{' '}
                excluded:{' '}
                {excluded.map((e) => `${e.fullName} (${e.reason})`).join('; ')}
              </p>
            )}

            <div className="border-line overflow-hidden rounded-lg border">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-surface border-line sticky top-0 border-b">
                    <tr>
                      <th className="px-3 py-2">
                        <Checkbox
                          checked={
                            eligible.length > 0 &&
                            selected.size === eligible.length
                          }
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                        Employee
                      </th>
                      <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                        Working Hours
                      </th>
                      <th className="text-muted px-3 py-2 text-xs font-medium tracking-wide uppercase">
                        Start Date
                      </th>
                      <th className="text-muted px-3 py-2 text-right text-xs font-medium tracking-wide uppercase">
                        Wage
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-muted px-3 py-6 text-center text-sm"
                        >
                          No eligible employees for this scope.
                        </td>
                      </tr>
                    )}
                    {eligible.map((employee) => (
                      <tr
                        key={employee.employeeId}
                        className="border-line border-b last:border-0"
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selected.has(employee.employeeId)}
                            onChange={() => {
                              toggle(employee.employeeId);
                            }}
                            aria-label={`Select ${employee.fullName}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div>{employee.fullName}</div>
                          <div className="text-muted text-xs">
                            {employee.code}
                            {employee.departmentName !== null
                              ? ` · ${employee.departmentName}`
                              : ''}
                          </div>
                          {employee.duplicateWarning !== null && (
                            <span className="bg-warning-soft text-warning-strong mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
                              {employee.duplicateWarning}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {employee.scheduleName ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {employee.contractStartDate.slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatINR(employee.wageMonthly)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {createError !== null && (
              <p className="border-danger-line bg-danger-soft text-ink rounded-sm border px-3 py-2 text-sm">
                {createError}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setStep('scope');
                }}
                disabled={createMutation.isPending}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  void onCreate();
                }}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Payrun'}
              </Button>
              <span className="text-muted ml-auto text-xs">
                {selected.size} / {eligible.length} selected
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
