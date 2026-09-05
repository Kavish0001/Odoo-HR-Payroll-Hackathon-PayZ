import {
  percentOf,
  roundPaise,
  sumPaise,
  type ComputationType,
  type PercentageBase,
  type RuleCategory,
} from '@payz/shared';

import {
  evaluateFormula,
  FormulaError,
  referencedRuleCodes,
  type FormulaContext,
} from './sandbox.js';

/**
 * The salary rule engine.
 *
 * Rules execute in ascending sequence. Each result is written into two lookup
 * contexts available to every later rule: `rules['HRA']` for a single rule and
 * `categories['ALLOWANCE']` for a running category total. That is what lets
 * GROSS at sequence 60 sum everything before it without hardcoding which rules
 * exist (rules P1, P2).
 *
 * Everything is integer paise. Rounding happens once, where a rule produces
 * its amount, and every total after that is integer addition, so the payslip
 * always adds up exactly (rule P6).
 */

export interface RuleDefinition {
  id: string;
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  computationType: ComputationType;
  fixedAmount: number | null;
  percentage: number | null;
  percentageBase: PercentageBase | null;
  percentageRuleCode: string | null;
  formula: string | null;
  quantity: number;
}

export interface ComputeInput {
  /** Contract wage in paise, from the period-applicable contract (rule C2). */
  wage: number;
  worked: {
    days: number;
    minutes: number;
    leaveDays: number;
    overtimeMinutes: number;
  };
  employee: { seniorityYears: number };
}

export interface ComputedLine {
  ruleId: string;
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  quantity: number;
  rate: number;
  /** Integer paise. Negative for deductions (rule P6). */
  amount: number;
}

export interface ComputeResult {
  lines: ComputedLine[];
  totals: {
    basic: number;
    allowance: number;
    gross: number;
    /** Negative. */
    deduction: number;
    net: number;
  };
  warnings: string[];
}

export class PayrollComputationError extends Error {
  readonly ruleCode: string | undefined;

  constructor(message: string, ruleCode?: string) {
    super(message);
    this.name = 'PayrollComputationError';
    this.ruleCode = ruleCode;
  }
}

/**
 * Rejects formulas that read a rule scheduled after them.
 *
 * Sequence ordering means nothing if a rule can read the future: the result
 * would depend on evaluation order in a way the configured sequence does not
 * describe. Caught before any computing starts, so a bad structure fails with
 * one clear message rather than a payslip of quietly wrong numbers.
 */
export function assertNoForwardReferences(
  rules: readonly RuleDefinition[],
): void {
  const sequenceByCode = new Map(
    rules.map((rule) => [rule.code, rule.sequence]),
  );
  const problems: string[] = [];

  for (const rule of rules) {
    if (rule.computationType !== 'FORMULA' || rule.formula === null) {
      continue;
    }

    for (const code of referencedRuleCodes(rule.formula)) {
      const referenced = sequenceByCode.get(code);
      if (referenced !== undefined && referenced >= rule.sequence) {
        problems.push(
          `${rule.code} (sequence ${String(rule.sequence)}) reads ${code} (sequence ${String(referenced)})`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new PayrollComputationError(
      `Salary rules reference results that are not computed yet:\n  ${problems.join('\n  ')}`,
    );
  }
}

function resolveBase(
  rule: RuleDefinition,
  input: ComputeInput,
  context: FormulaContext,
): number {
  switch (rule.percentageBase) {
    case 'CONTRACT_WAGE':
      return input.wage;
    case 'BASIC':
      return context.categories['BASIC'] ?? 0;
    case 'GROSS':
      return context.categories['GROSS'] ?? 0;
    case 'RULE': {
      const code = rule.percentageRuleCode;
      if (code === null) {
        throw new PayrollComputationError(
          `Rule ${rule.code} takes a percentage of another rule but names none`,
          rule.code,
        );
      }
      return context.rules[code] ?? 0;
    }
    default:
      // Defaulting to the contract wage would silently produce a plausible
      // wrong number, which is worse than refusing.
      throw new PayrollComputationError(
        `Rule ${rule.code} is a percentage but has no base selected`,
        rule.code,
      );
  }
}

export function computePayslip(
  rules: readonly RuleDefinition[],
  input: ComputeInput,
): ComputeResult {
  assertNoForwardReferences(rules);

  const ordered = [...rules].sort((a, b) => a.sequence - b.sequence);

  const context: FormulaContext = {
    rules: {},
    categories: {},
    contract: { wage: input.wage },
    worked: input.worked,
    employee: input.employee,
  };

  const lines: ComputedLine[] = [];
  const warnings: string[] = [];

  for (const rule of ordered) {
    let amount: number;
    let rate = 0;

    // GROSS and NET are totals of what came before, never independently
    // configured amounts, so they are resolved before the computation type is
    // consulted at all: whatever is set on the rule is irrelevant (rule P7).
    if (rule.category === 'GROSS' || rule.category === 'NET') {
      amount =
        rule.category === 'GROSS'
          ? (context.categories['BASIC'] ?? 0) +
            (context.categories['ALLOWANCE'] ?? 0)
          : (context.categories['GROSS'] ?? 0) +
            (context.categories['DEDUCTION'] ?? 0);

      context.rules[rule.code] = amount;
      context.categories[rule.category] =
        (context.categories[rule.category] ?? 0) + amount;

      lines.push({
        ruleId: rule.id,
        code: rule.code,
        name: rule.name,
        category: rule.category,
        sequence: rule.sequence,
        quantity: rule.quantity,
        rate: 0,
        amount,
      });
      continue;
    }

    switch (rule.computationType) {
      case 'FIXED': {
        if (rule.fixedAmount === null) {
          throw new PayrollComputationError(
            `Rule ${rule.code} is a fixed amount but has no value`,
            rule.code,
          );
        }
        rate = rule.fixedAmount;
        amount = roundPaise(rule.fixedAmount * rule.quantity);
        break;
      }

      case 'PERCENTAGE': {
        if (rule.percentage === null) {
          throw new PayrollComputationError(
            `Rule ${rule.code} is a percentage but has no percentage set`,
            rule.code,
          );
        }
        const base = resolveBase(rule, input, context);
        rate = rule.percentage;
        amount = roundPaise(percentOf(base, rule.percentage) * rule.quantity);
        break;
      }

      case 'FORMULA': {
        if (rule.formula === null) {
          throw new PayrollComputationError(
            `Rule ${rule.code} is a formula but has none written`,
            rule.code,
          );
        }
        try {
          const value = evaluateFormula(rule.formula, context, {
            onWarning: (message) => warnings.push(`${rule.code}: ${message}`),
          });
          amount = roundPaise(value * rule.quantity);
        } catch (error) {
          throw new PayrollComputationError(
            error instanceof FormulaError
              ? `Rule ${rule.code} failed: ${error.message}`
              : `Rule ${rule.code} failed to evaluate`,
            rule.code,
          );
        }
        break;
      }

      default:
        throw new PayrollComputationError(
          `Rule ${rule.code} has an unknown computation type`,
          rule.code,
        );
    }

    // NaN and Infinity are caught in the sandbox, but FIXED and PERCENTAGE do
    // not pass through it, so the check is repeated here for every path.
    if (!Number.isFinite(amount)) {
      throw new PayrollComputationError(
        `Rule ${rule.code} produced a value that is not a finite number`,
        rule.code,
      );
    }

    // Deductions are stored negative so gross-to-net is a plain sum (rule P6).
    // A deduction entered as a positive number is normalised rather than
    // silently added to pay.
    if (rule.category === 'DEDUCTION' && amount > 0) {
      amount = -amount;
    }

    context.rules[rule.code] = amount;
    context.categories[rule.category] =
      (context.categories[rule.category] ?? 0) + amount;

    lines.push({
      ruleId: rule.id,
      code: rule.code,
      name: rule.name,
      category: rule.category,
      sequence: rule.sequence,
      quantity: rule.quantity,
      rate,
      amount,
    });
  }

  const totals = {
    basic: context.categories['BASIC'] ?? 0,
    allowance: context.categories['ALLOWANCE'] ?? 0,
    gross: context.categories['GROSS'] ?? 0,
    deduction: context.categories['DEDUCTION'] ?? 0,
    net: context.categories['NET'] ?? 0,
  };

  assertTotalsAreSane(totals, lines, warnings, {
    hasGross: lines.some((line) => line.category === 'GROSS'),
    hasNet: lines.some((line) => line.category === 'NET'),
  });

  return { lines, totals, warnings };
}

/**
 * Post-compute sanity checks.
 *
 * A payslip that does not add up is worse than one that failed, because
 * nobody notices until someone is paid the wrong amount (guardrail 10.5).
 */
function assertTotalsAreSane(
  totals: ComputeResult['totals'],
  lines: readonly ComputedLine[],
  warnings: string[],
  present: { hasGross: boolean; hasNet: boolean },
): void {
  // A structure need not define GROSS or NET. An intern stipend might be a
  // single line. Only check the arithmetic that the structure actually claims.
  if (!present.hasGross) {
    return;
  }

  const expectedGross = totals.basic + totals.allowance;
  if (totals.gross !== expectedGross) {
    throw new PayrollComputationError(
      `Gross (${String(totals.gross)}) does not equal basic plus allowances (${String(expectedGross)})`,
    );
  }

  if (!present.hasNet) {
    return;
  }

  const expectedNet = totals.gross + totals.deduction;
  if (totals.net !== expectedNet) {
    throw new PayrollComputationError(
      `Net (${String(totals.net)}) does not equal gross plus deductions (${String(expectedNet)})`,
    );
  }

  if (totals.gross < 0) {
    throw new PayrollComputationError('Gross salary cannot be negative');
  }

  if (totals.net < 0) {
    throw new PayrollComputationError(
      'Deductions exceed gross salary, leaving a negative net',
    );
  }

  // Not fatal, but worth surfacing: it usually means a misconfigured rule.
  if (totals.gross > 0 && Math.abs(totals.deduction) > totals.gross * 0.6) {
    warnings.push(
      'Deductions exceed 60% of gross salary, which is unusually high',
    );
  }

  const lineSum = sumPaise(
    lines
      .filter((line) => line.category !== 'GROSS' && line.category !== 'NET')
      .map((line) => line.amount),
  );
  if (lineSum !== totals.net) {
    throw new PayrollComputationError(
      `Payslip lines sum to ${String(lineSum)} but net is ${String(totals.net)}`,
    );
  }
}
