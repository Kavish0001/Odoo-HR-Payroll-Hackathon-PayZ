import { describe, expect, it } from 'vitest';

import { rupeesToPaise } from '../money.js';

import { rupeesSchema } from './common.js';
import { contractSchema } from './hr.js';
import { salaryRuleSchema } from './payroll.js';

/**
 * A validation schema must not change the units of what it validates.
 *
 * `rupeesSchema` used to end in `.transform(rupees => rupees * 100)`. That is
 * applied wherever the schema is applied -- and the same schema is both the
 * resolver on a React form and the validator on the API route it posts to. So
 * a wage was converted twice and landed in the database a hundred times too
 * large: ₹50,000 typed into the contract form was saved as ₹50,00,000, two
 * extra zeros, silently.
 *
 * Nothing caught it because each side was correct on its own. These tests
 * pin the property that makes the pair correct together: parsing returns the
 * rupees it was given, and converting to paise is a separate, explicit step
 * the persistence layer takes exactly once.
 */
describe('rupee schemas validate without converting', () => {
  it('returns the rupees it was given, unchanged', () => {
    expect(rupeesSchema.parse(50_000)).toBe(50_000);
    expect(rupeesSchema.parse(12_345.67)).toBe(12_345.67);
    expect(rupeesSchema.parse(0)).toBe(0);
  });

  it('still rejects more than two decimal places', () => {
    expect(rupeesSchema.safeParse(100.123).success).toBe(false);
    expect(rupeesSchema.safeParse(100.12).success).toBe(true);
  });

  it('rejects negative and non-finite amounts', () => {
    expect(rupeesSchema.safeParse(-1).success).toBe(false);
    expect(rupeesSchema.safeParse(Number.NaN).success).toBe(false);
    expect(rupeesSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(
      false,
    );
  });
});

describe('a contract wage survives the round trip it actually takes', () => {
  const input = {
    reference: 'CON/2027/0001',
    employeeId: 7,
    startDate: '2027-01-01',
    wageMonthly: 50_000,
    status: 'DRAFT' as const,
  };

  it('parses the wage as rupees, not paise', () => {
    const parsed = contractSchema.parse(input);
    expect(parsed.wageMonthly).toBe(50_000);
  });

  it('is unchanged by being parsed twice, as client then API', () => {
    // The exact path that produced the bug: the browser validates the form
    // with this schema and posts the result, and the route validates that
    // same payload with the same schema before writing it.
    const onceOnTheClient = contractSchema.parse(input);
    const againOnTheServer = contractSchema.parse(onceOnTheClient);
    expect(againOnTheServer.wageMonthly).toBe(50_000);
  });

  it('reaches the column as paise only through the explicit conversion', () => {
    const parsed = contractSchema.parse(input);
    expect(rupeesToPaise(parsed.wageMonthly)).toBe(5_000_000);
  });

  it('still refuses a wage of zero', () => {
    expect(contractSchema.safeParse({ ...input, wageMonthly: 0 }).success).toBe(
      false,
    );
  });
});

describe('a fixed salary rule amount behaves the same way', () => {
  const rule = {
    structureId: 1,
    name: 'Basic Salary',
    code: 'BASIC',
    category: 'BASIC' as const,
    sequence: 1,
    computationType: 'FIXED' as const,
    fixedAmount: 42_000,
  };

  it('parses as rupees and is stable across a second parse', () => {
    const once = salaryRuleSchema.parse(rule);
    expect(once.fixedAmount).toBe(42_000);
    expect(salaryRuleSchema.parse(once).fixedAmount).toBe(42_000);
    expect(rupeesToPaise(once.fixedAmount ?? 0)).toBe(4_200_000);
  });
});
