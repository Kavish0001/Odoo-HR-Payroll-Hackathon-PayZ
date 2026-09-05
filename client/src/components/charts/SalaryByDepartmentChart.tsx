import {
  formatINR,
  formatINRCompact,
  type DepartmentSalaryPoint,
} from '@payz/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type TooltipValue, toAmount } from './format.js';
import { AXIS_TICK_STYLE, chartColor, GRID_STROKE } from './theme.js';

interface SalaryByDepartmentChartProps {
  data: readonly DepartmentSalaryPoint[];
}

/** Bar chart of net salary cost per department, one colour per bar. */
export function SalaryByDepartmentChart({
  data,
}: SalaryByDepartmentChartProps): React.JSX.Element {
  const chartData = data.map((point) => ({
    name: point.departmentName,
    totalNet: point.totalNet,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
        accessibilityLayer
        role="img"
        aria-label="Bar chart of net salary cost by department"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_STROKE}
          vertical={false}
        />
        <XAxis
          dataKey="name"
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
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="totalNet" name="Net salary" radius={[4, 4, 0, 0]}>
          {chartData.map((point, index) => (
            <Cell key={point.name} fill={chartColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
