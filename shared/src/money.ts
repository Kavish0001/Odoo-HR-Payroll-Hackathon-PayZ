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

  // The sign goes outside the symbol. Formatting the absolute value and
  // re-attaching the minus avoids the "₹-1,800.00" that a deduction would
  // otherwise print, which reads as a currency called "minus rupees".
  const sign = paise < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(Math.abs(paiseToRupees(paise)));

  return withSymbol ? `${sign}₹${formatted}` : `${sign}${formatted}`;
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

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const;

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
] as const;

/** 0..99 in words. Anything above needs the Indian grouping below. */
function twoDigitsToWords(value: number): string {
  if (value < 20) {
    return ONES[value] ?? '';
  }
  const tens = TENS[Math.floor(value / 10)] ?? '';
  const ones = ONES[value % 10] ?? '';
  return ones === '' ? tens : `${tens} ${ones}`;
}

/** 0..999 in words. */
function threeDigitsToWords(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds] ?? ''} Hundred`);
  }
  if (rest > 0) {
    parts.push(twoDigitsToWords(rest));
  }
  return parts.join(' ');
}

/** The Indian groups, largest first: crore, lakh, thousand, then 0..999. */
const GROUPS = [
  { divisor: 10_000_000, label: 'Crore' },
  { divisor: 100_000, label: 'Lakh' },
  { divisor: 1_000, label: 'Thousand' },
] as const;

/**
 * A whole number in words, grouped the Indian way (crore, lakh, thousand).
 *
 * Crore is not capped at 99: a figure beyond a hundred crore reads as
 * "One Hundred Twenty Crore" rather than needing a further unit, which is how
 * the convention actually works.
 */
function wholeNumberToWords(value: number): string {
  if (value === 0) {
    return 'Zero';
  }

  const parts: string[] = [];
  let remaining = value;

  for (const group of GROUPS) {
    const count = Math.floor(remaining / group.divisor);
    if (count > 0) {
      parts.push(`${threeDigitsToWords(count)} ${group.label}`);
      remaining %= group.divisor;
    }
  }

  if (remaining > 0) {
    parts.push(threeDigitsToWords(remaining));
  }

  return parts.join(' ');
}

/**
 * Paise as the words printed on a payslip, e.g.
 * "Rupees One Lakh Fifty Thousand and Twenty Paise Only".
 *
 * Indian payslips carry the net pay in words as well as figures, because a
 * figure can be altered after printing and a sentence cannot be altered
 * nearly as quietly. A negative amount is prefixed with "Minus" rather than
 * dropped, so a corrected payslip still reads correctly.
 */
export function formatINRWords(paise: Paise): string {
  assertInteger(paise, 'paise');

  const sign = paise < 0 ? 'Minus ' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / PAISE_PER_RUPEE);
  const remainder = absolute % PAISE_PER_RUPEE;

  const rupeeWords = `${sign}Rupees ${wholeNumberToWords(rupees)}`;
  if (remainder === 0) {
    return `${rupeeWords} Only`;
  }
  return `${rupeeWords} and ${wholeNumberToWords(remainder)} Paise Only`;
}
