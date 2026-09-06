import {
  rupeesToPaise,
  type SalaryRuleInput,
  type SalaryRuleRow,
} from '@payz/shared';
import { type SalaryRule } from '@prisma/client';

import { prisma } from '../../config/prisma.js';
import { unprocessable } from '../../middleware/errors.js';
import {
  assertNoForwardReferences,
  PayrollComputationError,
  type RuleDefinition,
} from '../payroll/engine.js';

/**
 * Shared conversions between the stored/validated rule shapes and the two
 * things every salary-config route needs: the API row the client renders,
 * and the payroll engine's `RuleDefinition` used to check sequence ordering
 * before a save is allowed to land (rule P1).
 */

/** A salary rule row plus the structure name every list and detail screen shows. */
export function toSalaryRuleRow(
  rule: SalaryRule,
  structureName: string,
): SalaryRuleRow {
  return {
    id: String(rule.id),
    structureId: String(rule.structureId),
    structureName,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    computationType: rule.computationType,
    fixedAmount: rule.fixedAmount,
    percentage: rule.percentage,
    percentageBase: rule.percentageBase,
    percentageRuleCode: rule.percentageRuleCode,
    formula: rule.formula,
    quantity: rule.quantity,
    active: rule.active,
  };
}

/** The payroll engine's shape for a rule, built from a stored row. */
export function toRuleDefinition(rule: SalaryRule): RuleDefinition {
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    category: rule.category,
    sequence: rule.sequence,
    computationType: rule.computationType,
    fixedAmount: rule.fixedAmount,
    percentage: rule.percentage,
    percentageBase: rule.percentageBase,
    percentageRuleCode: rule.percentageRuleCode,
    formula: rule.formula,
    quantity: rule.quantity,
  };
}

/**
 * A rule id that belongs to no row.
 *
 * The create path validates a rule against its siblings before it exists, and
 * with `autoincrement()` there is no id to quote until after the insert. Zero
 * is safe as the stand-in because `idSchema` requires a positive integer and
 * the sequence starts at one, so it can never collide with a saved rule.
 */
export const UNSAVED_RULE_ID = 0;

/** The same shape, built from a not-yet-saved form submission. */
export function toRuleDefinitionFromInput(
  body: SalaryRuleInput,
  id: number,
): RuleDefinition {
  return {
    id,
    code: body.code,
    name: body.name,
    category: body.category,
    sequence: body.sequence,
    computationType: body.computationType,
    // The engine computes in paise, so an unsaved rule has to be converted
    // the same way the stored one was.
    fixedAmount:
      body.fixedAmount == null ? null : rupeesToPaise(body.fixedAmount),
    percentage: body.percentage ?? null,
    percentageBase: body.percentageBase ?? null,
    percentageRuleCode: body.percentageRuleCode ?? null,
    formula: body.formula ?? null,
    quantity: body.quantity,
  };
}

/**
 * Rejects a save when the candidate rule set — the structure's other rules
 * plus this one, new or edited — has a formula reading a rule scheduled
 * after it. Sequence is what the engine trusts for execution order, so a
 * bad reference must be caught here, at save time, not discovered later at
 * payslip time (rule P1, guardrail 10.5).
 */
export function assertRuleSaveable(
  candidateRules: readonly RuleDefinition[],
): void {
  try {
    assertNoForwardReferences(candidateRules);
  } catch (error) {
    if (error instanceof PayrollComputationError) {
      throw unprocessable('FORWARD_REFERENCE', error.message);
    }
    throw error;
  }
}

/**
 * Distinct employees per structure, counted from the contracts that
 * reference it. One grouped query rather than a per-row count, since the
 * structures list renders every row's employee count at once.
 */
export async function employeeCountsByStructure(
  structureIds: readonly number[],
): Promise<Map<number, number>> {
  if (structureIds.length === 0) {
    return new Map();
  }

  const rows = await prisma.contract.groupBy({
    by: ['salaryStructureId', 'employeeId'],
    where: { salaryStructureId: { in: [...structureIds] } },
  });

  const sets = new Map<number, Set<number>>();
  for (const row of rows) {
    if (row.salaryStructureId === null) {
      continue;
    }
    const set = sets.get(row.salaryStructureId) ?? new Set<number>();
    set.add(row.employeeId);
    sets.set(row.salaryStructureId, set);
  }

  const counts = new Map<number, number>();
  for (const [id, set] of sets) {
    counts.set(id, set.size);
  }
  return counts;
}
