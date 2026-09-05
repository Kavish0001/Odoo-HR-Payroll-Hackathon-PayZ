/**
 * Money is stored and computed as integer paise, never as a float.
 *
 * A payslip is a column of figures that must add up exactly: NET is the sum
 * of the stored line amounts, and 0.1 + 0.2 !== 0.3 in binary floating point.
 * Rounding happens once, at the point a rule produces its amount, and every
 * total after that is integer addition (rule P6, P7).
 *
 * Deductions are stored negative, so gross-to-net is a plain sum rather than
 * a subtraction that has to know which lines are which.
 */

/** Integer paise. 1 rupee = 100 paise. */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;

export function rupeesToPaise(rupees: number): Paise {
  assertFinite(rupees, 'rupees');
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: Paise): number {
  assertInteger(paise, 'paise');
  return paise / PAISE_PER_RUPEE;
}

/**
 * Rounds a computed amount to whole paise, half away from zero.
 *
 * Half-up on the absolute value keeps a deduction of -0.5 rounding to -1
 * rather than to 0, so an employee is never quietly under-deducted purely
 * because the amount was negative. JavaScript's Math.round breaks ties
 * toward positive infinity, which is not symmetric.
 */
export function roundPaise(value: number): Paise {
  assertFinite(value, 'value');
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function sumPaise(amounts: readonly Paise[]): Paise {
  let total = 0;
  for (const amount of amounts) {
    assertInteger(amount, 'amount');
    total += amount;
  }
  return total;
}

/** Percentage of a base, rounded to whole paise. `percent` is 0..100. */
export function percentOf(base: Paise, percent: number): Paise {
  assertInteger(base, 'base');
  assertFinite(percent, 'percent');
  return roundPaise((base * percent) / 100);
}

/**
 * Formats paise for display, in Indian digit grouping (1,50,000.00).
 * Display only: never feed a formatted string back into arithmetic.
 */
export function formatINR(
  paise: Paise,
  options: { withSymbol?: boolean; decimals?: boolean } = {},
): string {
  const { withSymbol = true, decimals = true } = options;
  assertInteger(paise, 'paise');

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(paiseToRupees(paise));

  return withSymbol ? `₹${formatted}` : formatted;
}

/** Compact form for dashboard tiles: ₹18.4L, ₹1.2Cr. */
export function formatINRCompact(paise: Paise): string {
  assertInteger(paise, 'paise');
  const rupees = Math.abs(paiseToRupees(paise));
  const sign = paise < 0 ? '-' : '';

  if (rupees >= 10_000_000) {
    return `${sign}₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  }
  if (rupees >= 100_000) {
    return `${sign}₹${(rupees / 100_000).toFixed(1)}L`;
  }
  if (rupees >= 1_000) {
    return `${sign}₹${(rupees / 1_000).toFixed(1)}k`;
  }
  return `${sign}₹${rupees.toFixed(0)}`;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${value}`);
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(
      `${label} must be an integer number of paise, received ${value}`,
    );
  }
}
