import {
  formatINR,
  formatINRCompact,
  type SalaryTrendPoint,
} from '@payz/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { toAmount, type TooltipValue } from './format.js';
import { AXIS_TICK_STYLE, TOOLTIP_STYLE, GRID_STROKE } from './theme.js';

interface SalaryTrendChartProps {
  data: readonly SalaryTrendPoint[];
}

/** Line chart of net salary paid across the last few payroll periods. */
export function SalaryTrendChart({
  data,
}: SalaryTrendChartProps): React.JSX.Element {
  const chartData = data.map((point) => ({
    period: point.period,
    totalNet: point.totalNet,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart
        data={chartData}
        margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
        accessibilityLayer
        role="img"
        aria-label="Line chart of net salary trend across recent payroll periods"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_STROKE}
          vertical={false}
        />
        <XAxis
          dataKey="period"
          tick={AXIS_TICK_STYLE}
          stroke="var(--color-line)"
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TICK_STYLE}
          stroke="var(--color-line)"
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatINRCompact(value)}
        />
        <Tooltip
          formatter={(value: TooltipValue) => [
            formatINR(toAmount(value)),
            'Net salary',
          ]}
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          type="monotone"
          dataKey="totalNet"
          name="Net salary"
          stroke="var(--color-ink)"
          strokeWidth={2}
          dot={{
            r: 3,
            fill: 'var(--color-raised)',
            stroke: 'var(--color-ink)',
            strokeWidth: 1.5,
          }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
