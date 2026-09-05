import type { TimeOffUnit } from '@payz/shared';

/**
 * Renders a leave quantity in its own unit — `2.5d`, `6h`.
 *
 * Shared by the dashboard and the request form so the same balance can never
 * be spelled two different ways on two screens.
 */
export function formatQty(value: number, unit: TimeOffUnit): string {
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded)}${unit === 'HOURS' ? 'h' : 'd'}`;
}
