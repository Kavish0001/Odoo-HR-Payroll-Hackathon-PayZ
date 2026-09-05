/**
 * Categorical chart colours, read from the CSS custom properties defined in
 * styles/index.css so every chart in the app draws from the same
 * colour-vision-safe palette instead of inventing its own.
 */
export const CHART_COLORS: readonly string[] = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

/** Cycles through the palette so a chart with more series than colours never breaks. */
export function chartColor(index: number): string {
  const palette = CHART_COLORS;
  return palette[index % palette.length] ?? 'var(--color-chart-1)';
}

export const AXIS_TICK_STYLE = { fontSize: 11, fill: 'var(--color-muted)' };
export const GRID_STROKE = 'var(--color-line)';
