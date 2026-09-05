import { describe, expect, it } from 'vitest';

import {
  assertNoForwardReferences,
  computePayslip,
  PayrollComputationError,
  type ComputeInput,
  type RuleDefinition,
} from './engine.js';

/** Builds a rule with sensible defaults so each test states only what matters. */
function rule(
  overrides: Partial<RuleDefinition> &
    Pick<RuleDefinition, 'code' | 'category' | 'sequence'>,
): RuleDefinition {
  return {
    id: `id-${overrides.code}`,
    name: overrides.code,
    computationType: 'FIXED',
    fixedAmount: null,
    percentage: null,
    percentageBase: null,
    percentageRuleCode: null,
    formula: null,
    quantity: 1,
    ...overrides,
  };
}

const input: ComputeInput = {
  wage: 8_500_000, // Rs 85,000
  worked: { days: 22, minutes: 10_560, leaveDays: 0, overtimeMinutes: 0 },
  employee: { seniorityYears: 3 },
};

/** The structure from the wireframe, in its documented sequence. */
const regularSalary: RuleDefinition[] = [
  rule({
    code: 'BASIC',
    category: 'BASIC',
    sequence: 1,
    computationType: 'PERCENTAGE',
    percentage: 50,
    percentageBase: 'CONTRACT_WAGE',
  }),
  rule({
    code: 'HRA',
    category: 'ALLOWANCE',
    sequence: 10,
    computationType: 'PERCENTAGE',
    percentage: 40,
    percentageBase: 'BASIC',
  }),
  rule({
    code: 'STD',
    category: 'ALLOWANCE',
    sequence: 20,
    computationType: 'FIXED',
    fixedAmount: 1_000_000,
  }),
  rule({ code: 'GROSS', category: 'GROSS', sequence: 60 }),
  rule({
    code: 'PF',
    category: 'DEDUCTION',
    sequence: 80,
    computationType: 'PERCENTAGE',
    percentage: 12,
    percentageBase: 'BASIC',
  }),
  rule({
    code: 'PT',
    category: 'DEDUCTION',
    sequence: 100,
    computationType: 'FIXED',
    fixedAmount: 20_000,
  }),
  rule({ code: 'NET', category: 'NET', sequence: 110 }),
];

describe('sequence ordering (rule P1)', () => {
  it('computes rules in ascending sequence regardless of input order', () => {
    const shuffled = [...regularSalary].reverse();
    const result = computePayslip(shuffled, input);

    expect(result.lines.map((line) => line.code)).toEqual([
      'BASIC',
      'HRA',
      'STD',
      'GROSS',
      'PF',
      'PT',
      'NET',
    ]);
  });

  it('lets a later rule build on an earlier one through the context (rule P2)', () => {
    const result = computePayslip(regularSalary, input);
    const byCode = new Map(
      result.lines.map((line) => [line.code, line.amount]),
    );

    // BASIC = 50% of 85,000 = 42,500
    expect(byCode.get('BASIC')).toBe(4_250_000);
    // HRA = 40% of BASIC, which only works because BASIC ran first
    expect(byCode.get('HRA')).toBe(1_700_000);
  });
});

describe('the three computation types', () => {
  it('computes a fixed amount times quantity', () => {
    const result = computePayslip(
      [
        rule({
          code: 'FIX',
          category: 'ALLOWANCE',
          sequence: 1,
          computationType: 'FIXED',
          fixedAmount: 100_000,
          quantity: 3,
        }),
      ],
      input,
    );
    expect(result.lines[0]?.amount).toBe(300_000);
  });

  it('computes a percentage of the contract wage', () => {
    const result = computePayslip(
      [
        rule({
          code: 'BASIC',
          category: 'BASIC',
          sequence: 1,
          computationType: 'PERCENTAGE',
          percentage: 50,
          percentageBase: 'CONTRACT_WAGE',
        }),
      ],
      input,
    );
    expect(result.lines[0]?.amount).toBe(4_250_000);
  });

  it('computes a formula against the rule context', () => {
    const rules = [
      rule({
        code: 'BASIC',
        category: 'BASIC',
        sequence: 1,
        computationType: 'FIXED',
        fixedAmount: 5_000_000,
      }),
      rule({
        code: 'BONUS',
        category: 'ALLOWANCE',
        sequence: 10,
        computationType: 'FORMULA',
        formula: "result = rules['BASIC'] * 0.1",
      }),
    ];
    const result = computePayslip(rules, input);
    expect(result.lines[1]?.amount).toBe(500_000);
  });

  it('prorates by worked days through a formula', () => {
    const rules = [
      rule({
        code: 'BASIC',
        category: 'BASIC',
        sequence: 1,
        computationType: 'FORMULA',
        formula: 'contract.wage * worked.days / 22',
      }),
    ];
    const halfMonth = { ...input, worked: { ...input.worked, days: 11 } };
    expect(computePayslip(rules, halfMonth).lines[0]?.amount).toBe(4_250_000);
  });
});

describe('gross and net are totals, not configured amounts (rule P7)', () => {
  it('sets gross to basic plus allowances', () => {
    const result = computePayslip(regularSalary, input);
    // 42,500 basic + 17,000 HRA + 10,000 standard = 69,500
    expect(result.totals.gross).toBe(6_950_000);
  });

  it('sets net to gross plus the negative deductions', () => {
    const result = computePayslip(regularSalary, input);
    // PF 12% of 42,500 = 5,100; PT = 200. Net = 69,500 - 5,300 = 64,200
    expect(result.totals.deduction).toBe(-530_000);
    expect(result.totals.net).toBe(6_420_000);
  });

  it('ignores a configured amount on the gross rule itself', () => {
    const withNoise = regularSalary.map((r) =>
      r.code === 'GROSS'
        ? { ...r, computationType: 'FIXED' as const, fixedAmount: 99_999_999 }
        : r,
    );
    expect(computePayslip(withNoise, input).totals.gross).toBe(6_950_000);
  });
});

describe('deductions (rule P6)', () => {
  it('stores deductions negative even when configured positive', () => {
    const result = computePayslip(regularSalary, input);
    const pf = result.lines.find((line) => line.code === 'PF');
    expect(pf?.amount).toBeLessThan(0);
  });

  it('refuses a payslip where deductions exceed gross', () => {
    const rules = [
      rule({
        code: 'BASIC',
        category: 'BASIC',
        sequence: 1,
        computationType: 'FIXED',
        fixedAmount: 1_000_000,
      }),
      rule({ code: 'GROSS', category: 'GROSS', sequence: 60 }),
      rule({
        code: 'HUGE',
        category: 'DEDUCTION',
        sequence: 80,
        computationType: 'FIXED',
        fixedAmount: 5_000_000,
      }),
      rule({ code: 'NET', category: 'NET', sequence: 110 }),
    ];
    expect(() => computePayslip(rules, input)).toThrow(/negative net/);
  });

  it('warns when deductions are unusually high but still valid', () => {
    const rules = [
      rule({
        code: 'BASIC',
        category: 'BASIC',
        sequence: 1,
        computationType: 'FIXED',
        fixedAmount: 1_000_000,
      }),
      rule({ code: 'GROSS', category: 'GROSS', sequence: 60 }),
      rule({
        code: 'BIG',
        category: 'DEDUCTION',
        sequence: 80,
        computationType: 'FIXED',
        fixedAmount: 700_000,
      }),
      rule({ code: 'NET', category: 'NET', sequence: 110 }),
    ];
    expect(computePayslip(rules, input).warnings.join(' ')).toContain('60%');
  });
});

describe('forward references are refused before computing', () => {
  it('rejects a rule reading a later rule', () => {
    const rules = [
      rule({
        code: 'EARLY',
        category: 'ALLOWANCE',
        sequence: 10,
        computationType: 'FORMULA',
        formula: "rules['LATE']",
      }),
      rule({
        code: 'LATE',
        category: 'ALLOWANCE',
        sequence: 20,
        computationType: 'FIXED',
        fixedAmount: 100,
      }),
    ];
    expect(() => {
      assertNoForwardReferences(rules);
    }).toThrow(PayrollComputationError);
    expect(() => computePayslip(rules, input)).toThrow(/not computed yet/);
  });

  it('rejects a rule reading itself', () => {
    const rules = [
      rule({
        code: 'SELF',
        category: 'ALLOWANCE',
        sequence: 10,
        computationType: 'FORMULA',
        formula: "rules['SELF'] + 1",
      }),
    ];
    expect(() => {
      assertNoForwardReferences(rules);
    }).toThrow(/not computed yet/);
  });

  it('allows a rule reading an earlier one', () => {
    expect(() => {
      assertNoForwardReferences(regularSalary);
    }).not.toThrow();
  });
});

describe('misconfiguration fails loudly rather than guessing', () => {
  it('refuses a percentage rule with no base', () => {
    const rules = [
      rule({
        code: 'X',
        category: 'ALLOWANCE',
        sequence: 1,
        computationType: 'PERCENTAGE',
        percentage: 10,
      }),
    ];
    expect(() => computePayslip(rules, input)).toThrow(/no base selected/);
  });

  it('refuses a fixed rule with no amount', () => {
    const rules = [
      rule({
        code: 'X',
        category: 'ALLOWANCE',
        sequence: 1,
        computationType: 'FIXED',
      }),
    ];
    expect(() => computePayslip(rules, input)).toThrow(/no value/);
  });

  it('refuses a formula rule with no formula', () => {
    const rules = [
      rule({
        code: 'X',
        category: 'ALLOWANCE',
        sequence: 1,
        computationType: 'FORMULA',
      }),
    ];
    expect(() => computePayslip(rules, input)).toThrow(/has none written/);
  });

  it('surfaces a failing formula as a rule error naming the rule', () => {
    const rules = [
      rule({
        code: 'BAD',
        category: 'ALLOWANCE',
        sequence: 1,
        computationType: 'FORMULA',
        formula: 'rules.BASIC / 0',
      }),
    ];
    try {
      computePayslip(rules, input);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as PayrollComputationError).ruleCode).toBe('BAD');
    }
  });
});

describe('integer money (rule P6)', () => {
  it('keeps every amount a whole number of paise', () => {
    const odd = { ...input, wage: 3_333_333 };
    const result = computePayslip(regularSalary, odd);

    for (const line of result.lines) {
      expect(Number.isInteger(line.amount)).toBe(true);
    }
    for (const total of Object.values(result.totals)) {
      expect(Number.isInteger(total)).toBe(true);
    }
  });

  it('makes the lines add up to net exactly, with no rounding drift', () => {
    // The assertion inside the engine already enforces this; the test proves
    // it holds for a wage that does not divide evenly.
    const odd = { ...input, wage: 3_333_333 };
    const result = computePayslip(regularSalary, odd);
    expect(result.totals.net).toBe(
      result.totals.gross + result.totals.deduction,
    );
  });
});

describe('idempotency (rule P9)', () => {
  it('produces identical output when run twice', () => {
    const first = computePayslip(regularSalary, input);
    const second = computePayslip(regularSalary, input);
    expect(second).toEqual(first);
  });
});
