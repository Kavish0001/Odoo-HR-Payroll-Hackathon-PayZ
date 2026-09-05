import { describe, expect, it, vi } from 'vitest';

import {
  evaluateFormula,
  FormulaError,
  referencedRuleCodes,
  type FormulaContext,
} from './sandbox.js';

function context(overrides: Partial<FormulaContext> = {}): FormulaContext {
  return {
    rules: { BASIC: 5_000_000, HRA: 2_000_000 },
    categories: { BASIC: 5_000_000, ALLOWANCE: 3_000_000, GROSS: 8_000_000 },
    contract: { wage: 8_500_000 },
    worked: { days: 22, minutes: 10_560, leaveDays: 1, overtimeMinutes: 120 },
    employee: { seniorityYears: 3 },
    ...overrides,
  };
}

describe('evaluating real formulas', () => {
  it('evaluates the wireframe example', () => {
    expect(evaluateFormula("result = categories['BASIC']", context())).toBe(
      5_000_000,
    );
  });

  it('accepts a bare expression without the result assignment', () => {
    expect(evaluateFormula("categories['BASIC'] * 0.4", context())).toBe(
      2_000_000,
    );
  });

  it('reads rules by dot and by bracket alike', () => {
    expect(evaluateFormula('rules.BASIC', context())).toBe(5_000_000);
    expect(evaluateFormula("rules['HRA']", context())).toBe(2_000_000);
  });

  it('prorates by worked days, the reason formulas exist at all', () => {
    const value = evaluateFormula(
      'result = contract.wage * worked.days / 22',
      context(),
    );
    expect(value).toBe(8_500_000);
  });

  it('supports conditionals for slab-style rules', () => {
    const formula = "categories['GROSS'] > 7500000 ? 200000 : 100000";
    expect(evaluateFormula(formula, context())).toBe(200_000);
  });

  it('allows the whitelisted Math helpers', () => {
    expect(evaluateFormula('Math.min(rules.BASIC, 3000000)', context())).toBe(
      3_000_000,
    );
    expect(evaluateFormula('Math.round(1234.6)', context())).toBe(1235);
    expect(evaluateFormula('Math.max(1, 2, 3)', context())).toBe(3);
  });

  it('honours operator precedence and parentheses', () => {
    expect(evaluateFormula('2 + 3 * 4', context())).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', context())).toBe(20);
  });
});

describe('refusing dangerous input (guardrail 10.5)', () => {
  // Each of these is unparseable rather than blocked by a denylist, so there
  // is no spelling that slips past.
  it.each([
    ['require', "require('fs')"],
    ['process', 'process.env.JWT_SECRET'],
    ['globalThis', 'globalThis.process'],
    ['constructor escape', "rules.constructor('return 1')()"],
    ['__proto__', 'rules.__proto__'],
    ['prototype', 'rules.prototype'],
    ['function declaration', 'function evil() { return 1 }'],
    ['arrow function', '() => 1'],
    ['statement separator', 'result = 1; console.log(1)'],
    ['template literal', 'result = `${rules.BASIC}`'],
    ['object literal', 'result = { a: 1 }'],
    ['assignment to something else', 'rules.BASIC = 0'],
    ['unknown identifier', 'secretKey * 2'],
    ['non-whitelisted Math', 'Math.random()'],
    ['calling a non-Math value', 'rules.BASIC(1)'],
  ])('rejects %s', (_label, formula) => {
    expect(() => evaluateFormula(formula, context())).toThrow(FormulaError);
  });

  it('rejects division by zero rather than producing Infinity', () => {
    expect(() => evaluateFormula('rules.BASIC / 0', context())).toThrow(
      /Division by zero/,
    );
  });

  it('rejects a result that is not a finite number', () => {
    expect(() => evaluateFormula("'abc' * 2", context())).toThrow(FormulaError);
  });

  it('does not leak the secret even when the identifier looks plausible', () => {
    expect(() => evaluateFormula('env.JWT_SECRET', context())).toThrow(
      /Unknown identifier/,
    );
  });
});

describe('referencing a rule that has not run yet (rule P2)', () => {
  it('reads zero and warns rather than yielding undefined', () => {
    const onWarning = vi.fn();
    const value = evaluateFormula("rules['NOTYET'] + 100", context(), {
      onWarning,
    });

    expect(value).toBe(100);
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning.mock.calls[0]?.[0]).toContain('NOTYET');
  });
});

describe('referencedRuleCodes', () => {
  it('finds codes in both access styles, for the forward-reference check', () => {
    const codes = referencedRuleCodes(
      'result = rules[\'BASIC\'] + rules.HRA - rules["PF"]',
    );
    expect(codes.sort()).toEqual(['BASIC', 'HRA', 'PF']);
  });

  it('returns nothing for a formula that reads no rules', () => {
    expect(referencedRuleCodes('contract.wage * 0.5')).toEqual([]);
  });
});
