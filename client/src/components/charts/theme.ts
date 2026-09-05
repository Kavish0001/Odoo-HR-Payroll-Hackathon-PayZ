/**
 * Chart styling for Brushed Steel Minimalism.
 *
 * Charts do not use categorical colour. Every series is the same tinted fill
 * with a dark top edge, and shape carries the comparison instead of hue. Red
 * appears only when a value is flagged as an anomaly, which keeps it readable
 * as a warning rather than as one series among several.
 */

/** The tinted fill used by every bar, area and segment. */
export const CHART_FILL = 'var(--color-steel-100)';

/** The dark rule capping each bar, which is what makes heights comparable. */
export const CHART_EDGE = 'var(--color-ink)';

/** Reserved for a flagged value. Nothing routine should use this. */
export const CHART_ANOMALY = 'var(--color-signal)';

export const CHART_COLORS: readonly string[] = [CHART_FILL];

/**
 * Kept for callers that still index a palette. Every index returns the same
 * fill on purpose: the design language deliberately has no categorical scale.
 */
export function chartColor(_index: number): string {
  return CHART_FILL;
}

/** Bar fill, red only where the caller marks the point as an anomaly. */
export function barFill(isAnomaly = false): string {
  return isAnomaly ? CHART_ANOMALY : CHART_FILL;
}

export const AXIS_TICK_STYLE = {
  fontSize: 10,
  fill: 'var(--color-muted)',
  fontFamily: 'var(--font-mono)',
  letterSpacing: '0.08em',
};

export const GRID_STROKE = 'var(--color-steel-300)';

export const TOOLTIP_STYLE = {
  border: '1px solid var(--color-steel-300)',
  borderRadius: '2px',
  background: '#ffffff',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
} as const;
