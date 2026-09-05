/**
 * Recharts' own `ValueType` (from `DefaultTooltipContent`) is not re-exported
 * off the package root, so this restates its shape locally rather than
 * reaching into a `recharts/types/**` subpath that could move between
 * versions. Structurally identical, so it is assignable wherever recharts
 * expects the real thing.
 */
export type TooltipValue = number | string | (number | string)[];

/** Recharts hands tooltip/axis values through as `ValueType`; this always yields a number. */
export function toAmount(value: TooltipValue): number {
  if (typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === 'number' ? first : Number(first ?? 0);
  }
  return Number(value);
}
