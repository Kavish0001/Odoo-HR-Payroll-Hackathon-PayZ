import { describe, expect, it } from 'vitest';

import {
  formatINR,
  formatINRCompact,
  paiseToRupees,
  percentOf,
  roundPaise,
  rupeesToPaise,
  sumPaise,
} from './money.js';

describe('rupeesToPaise', () => {
  it('converts whole rupees', () => {
    expect(rupeesToPaise(85_000)).toBe(8_500_000);
  });

  it('converts fractional rupees to whole paise', () => {
    expect(rupeesToPaise(1234.56)).toBe(123_456);
  });

  it('rejects a non-finite amount rather than producing NaN paise', () => {
    expect(() => rupeesToPaise(Number.NaN)).toThrow(RangeError);
    expect(() => rupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('roundPaise', () => {
  it('rounds halves away from zero, symmetrically for both signs', () => {
    // Math.round(-0.5) is -0, which would silently under-deduct. Deductions
    // are stored negative, so the sign must not change the magnitude.
    expect(roundPaise(0.5)).toBe(1);
    expect(roundPaise(-0.5)).toBe(-1);
    expect(roundPaise(2.5)).toBe(3);
    expect(roundPaise(-2.5)).toBe(-3);
  });

  it('leaves whole paise untouched', () => {
    expect(roundPaise(4200)).toBe(4200);
    expect(roundPaise(-4200)).toBe(-4200);
  });
});

describe('sumPaise', () => {
  it('is exact where floating point rupees would not be', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; in paise it is exact.
    expect(sumPaise([10, 20])).toBe(30);
  });

  it('sums gross and negative deductions to net, as a payslip does', () => {
    const gross = 8_000_000;
    const providentFund = -300_000;
    const professionalTax = -200_000;

    expect(sumPaise([gross, providentFund, professionalTax])).toBe(7_500_000);
  });

  it('returns zero for an empty payslip', () => {
    expect(sumPaise([])).toBe(0);
  });

  it('rejects a non-integer amount, which would mean a float leaked in', () => {
    expect(() => sumPaise([100, 0.5])).toThrow(RangeError);
  });
});

describe('percentOf', () => {
  it('computes a percentage of a base, rounded to whole paise', () => {
    // HRA at 40% of a 50,000 basic.
    expect(percentOf(5_000_000, 40)).toBe(2_000_000);
  });

  it('rounds rather than truncating', () => {
    expect(percentOf(333, 50)).toBe(167);
  });

  it('handles a zero percentage', () => {
    expect(percentOf(5_000_000, 0)).toBe(0);
  });
});

describe('formatINR', () => {
  it('groups digits in the Indian convention', () => {
    expect(formatINR(15_000_000)).toBe('₹1,50,000.00');
  });

  it('omits decimals when asked', () => {
    expect(formatINR(8_500_000, { decimals: false })).toBe('₹85,000');
  });

  it('omits the symbol when asked', () => {
    expect(formatINR(8_500_000, { withSymbol: false, decimals: false })).toBe(
      '85,000',
    );
  });
});

describe('formatINRCompact', () => {
  it('uses lakh and crore for dashboard tiles', () => {
    // 18,400,000 paise = ₹1,84,000 -> 1.8L
    expect(formatINRCompact(18_400_000)).toBe('₹1.8L');
    // 1,200,000,000 paise = ₹1,20,00,000 -> 1.2 crore
    expect(formatINRCompact(1_200_000_000)).toBe('₹1.2Cr');
    expect(formatINRCompact(1_243_200)).toBe('₹12.4k');
  });

  it('switches unit at each threshold', () => {
    expect(formatINRCompact(99_900)).toBe('₹999'); // under a thousand
    expect(formatINRCompact(100_000)).toBe('₹1.0k'); // ₹1,000
    expect(formatINRCompact(10_000_000)).toBe('₹1.0L'); // ₹1,00,000
    expect(formatINRCompact(1_000_000_000)).toBe('₹1.0Cr'); // ₹1,00,00,000
  });

  it('keeps the sign for a negative total', () => {
    expect(formatINRCompact(-184_000_000)).toBe('-₹18.4L');
  });
});

describe('round trip', () => {
  it('survives rupees to paise and back', () => {
    expect(paiseToRupees(rupeesToPaise(85_000))).toBe(85_000);
    expect(paiseToRupees(rupeesToPaise(1234.56))).toBe(1234.56);
  });
});
