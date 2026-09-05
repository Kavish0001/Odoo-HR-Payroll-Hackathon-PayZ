import type { PayslipStatus } from '@payz/shared';

import { chartColor } from './theme.js';

interface PayslipStatusChartProps {
  data: readonly { status: PayslipStatus; count: number }[];
}

const STATUS_ORDER: readonly PayslipStatus[] = ['PAID', 'DONE', 'DRAFT', 'CANCELLED'];
const STATUS_LABEL: Record<PayslipStatus, string> = {
  PAID: 'Paid',
  DONE: 'Done',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
};

/**
 * Proportional horizontal bars per payslip status. Plain markup rather than
 * an SVG chart, so the counts are readable text and the bar is decoration —
 * nothing here depends on colour alone to convey meaning.
 */
export function PayslipStatusChart({ data }: PayslipStatusChartProps): React.JSX.Element {
  const byStatus = new Map(data.map((row) => [row.status, row.count]));
  const total = data.reduce((sum, row) => sum + row.count, 0);

  return (
    <ul className="space-y-2.5" aria-label="Payslip status breakdown">
      {STATUS_ORDER.map((status, index) => {
        const count = byStatus.get(status) ?? 0;
        const share = total === 0 ? 0 : (count / total) * 100;
        return (
          <li key={status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: chartColor(index) }}
                />
                {STATUS_LABEL[status]}
              </span>
              <span className="text-muted font-mono">{count}</span>
            </div>
            <div className="bg-line/60 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${String(share)}%`, backgroundColor: chartColor(index) }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
