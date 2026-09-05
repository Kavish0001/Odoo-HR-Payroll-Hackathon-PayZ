import { describe, expect, it } from 'vitest';

import { evaluateFormula } from '../payroll/sandbox.js';

import { sampleFormulaContext } from './salary-rules.routes.js';

/** 50,000 a month, in paise, as the preview route receives it. */
const preview = {
  formula: '',
  wage: 5_000_000,
  workedDays: 22,
  seniorityYears: 3,
};

/**
 * The complaint the fix answers: the tester previewed every category and
 * rule reference as 0, because the context it built was empty. These pin the
 * formulas an author is most likely to type first — starting with the one in
 * the project checklist — to non-zero, self-consistent numbers.
 */
describe('formula preview sample context', () => {
  it('gives the checklist example a believable number instead of zero', () => {
    const value = evaluateFormula(
      "result = categories['BASIC']",
      sampleFormulaContext(preview),
    );

    expect(value).toBe(2_500_000);
  });

  it('resolves a reference to another rule', () => {
    const value = evaluateFormula(
      "result = rules['BASIC'] * 0.1",
      sampleFormulaContext(preview),
    );

    expect(value).toBeGreaterThan(0);
  });

  it('adds up: gross is basic plus allowances, net is gross plus deductions', () => {
    const context = sampleFormulaContext(preview);

    expect(context.categories['GROSS']).toBe(
      (context.categories['BASIC'] ?? 0) +
        (context.categories['ALLOWANCE'] ?? 0),
    );
    expect(context.categories['NET']).toBe(
      (context.categories['GROSS'] ?? 0) +
        (context.categories['DEDUCTION'] ?? 0),
    );
  });

  it('keeps deductions negative, as rule P6 has them on a real payslip', () => {
    const context = sampleFormulaContext(preview);

    expect(context.categories['DEDUCTION']).toBeLessThan(0);
    expect(context.rules['PF']).toBeLessThan(0);
  });

  it('carries the caller-supplied wage, days and seniority through untouched', () => {
    const context = sampleFormulaContext(preview);

    expect(context.contract.wage).toBe(preview.wage);
    expect(context.worked.days).toBe(preview.workedDays);
    expect(context.employee.seniorityYears).toBe(preview.seniorityYears);
  });

  it('scales with the wage, so changing it changes the preview', () => {
    const doubled = sampleFormulaContext({ ...preview, wage: 10_000_000 });

    expect(doubled.categories['BASIC']).toBe(5_000_000);
  });

  it('previews a seniority formula against the seniority that was typed', () => {
    const value = evaluateFormula(
      "result = rules['BASIC'] * Math.min(employee.seniorityYears, 5) * 0.01",
      sampleFormulaContext(preview),
    );

    expect(value).toBe(2_500_000 * 3 * 0.01);
  });
});
