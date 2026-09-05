import { formatINR, RULE_CATEGORIES } from '@payz/shared';
import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';

import { payslipPdfUrl, usePayslip } from '../../api/payruns.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { useAuth } from '../../lib/auth.js';
import { CategoryBadge } from '../salaryConfig/CategoryBadge.js';

/** GROSS and NET are totals of what came before, so their rows are emphasised. */
const EMPHASISED_CATEGORIES = new Set(['GROSS', 'NET']);

export function PayslipDetailPage(): React.JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { allowed } = useAuth();
  const payslipQuery = usePayslip(id);
  const payslip = payslipQuery.data;

  if (payslipQuery.isLoading) {
    return <p className="text-muted text-sm">Loading…</p>;
  }
  if (payslipQuery.isError || payslip === undefined) {
    return (
      <p className="border-danger-line bg-danger-soft text-ink rounded-sm border px-3 py-2 text-sm">
        Could not load this payslip.
      </p>
    );
  }

  // An employee reaching their own payslip holds `readSelf` and nothing else
  // in payroll, so the two things here that lead out of their own record --
  // the payrun link and the pre-finalisation warnings, which are HR's queue
  // rather than the employee's -- are not offered to them.
  const isPayrollView = allowed('read', 'payslip');

  const groups = RULE_CATEGORIES.map((category) => ({
    category,
    lines: payslip.lines
      .filter((line) => line.category === category)
      .sort((a, b) => a.sequence - b.sequence),
  })).filter((group) => group.lines.length > 0);

  return (
    <div>
      <PageHeader
        title={payslip.number}
        breadcrumbs={[
          { label: 'Payslips', to: '/payroll/payslips' },
          { label: payslip.number },
        ]}
        subtitle={`${payslip.employeeName} · ${payslip.periodStart.slice(0, 10)} – ${payslip.periodEnd.slice(0, 10)}`}
        actions={
          <Button
            onClick={() => {
              window.open(payslipPdfUrl(payslip.id), '_blank', 'noopener');
            }}
          >
            Print Payslip
          </Button>
        }
      />

      {isPayrollView && payslip.warnings.length > 0 && (
        <p className="border-warning-line bg-warning-soft text-warning-strong mb-4 rounded-md border px-3 py-2 text-sm">
          {payslip.warnings.join(', ')}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Employee</p>
          <p className="mt-1 text-sm font-medium">{payslip.employeeName}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">
            Structure
          </p>
          <p className="mt-1 text-sm font-medium">{payslip.structureName}</p>
        </Card>
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Pay Run</p>
          {isPayrollView ? (
            <Link
              to={`/payroll/payruns/${payslip.payrunId}`}
              className="hover:text-ink mt-1 block text-sm font-medium hover:underline"
            >
              {payslip.payrunName}
            </Link>
          ) : (
            <p className="mt-1 text-sm font-medium">{payslip.payrunName}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Period</p>
          <p className="mt-1 text-sm font-medium">
            {payslip.periodStart.slice(0, 10)} –{' '}
            {payslip.periodEnd.slice(0, 10)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Status</p>
          <p className="mt-1">
            <StatusBadge status={payslip.status} dot />
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-muted text-xs tracking-wide uppercase">
            Worked Days
          </p>
          <p className="mt-1 font-mono text-sm font-medium">
            {payslip.workedDays}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface border-line border-b">
            <tr>
              <th className="text-muted px-4 py-2.5 text-xs font-medium tracking-wide uppercase">
                Rule
              </th>
              <th className="text-muted px-4 py-2.5 text-xs font-medium tracking-wide uppercase">
                Category
              </th>
              <th className="text-muted px-4 py-2.5 text-right text-xs font-medium tracking-wide uppercase">
                Amount
              </th>
              <th className="text-muted px-4 py-2.5 text-right text-xs font-medium tracking-wide uppercase">
                Code
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.category}>
                <tr className="bg-surface/60">
                  <td colSpan={4} className="px-4 py-1.5">
                    <CategoryBadge category={group.category} />
                  </td>
                </tr>
                {group.lines.map((line) => {
                  const emphasise = EMPHASISED_CATEGORIES.has(line.category);
                  const isDeduction = line.amount < 0;
                  return (
                    <tr
                      key={line.id}
                      className={
                        emphasise
                          ? 'bg-accent-soft border-line border-b last:border-0'
                          : 'border-line border-b last:border-0'
                      }
                    >
                      <td
                        className={`px-4 py-2.5 ${emphasise ? 'font-semibold' : ''}`}
                      >
                        {line.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <CategoryBadge category={line.category} />
                      </td>
                      {/* A deduction is a routine part of a payslip, not an
                          alarm. The minus sign already says which direction it
                          runs, so the accent stays reserved for things needing
                          action. */}
                      <td
                        className={`px-4 py-2.5 text-right font-mono ${
                          isDeduction
                            ? 'text-muted'
                            : emphasise
                              ? 'font-semibold'
                              : ''
                        }`}
                      >
                        {formatINR(line.amount)}
                      </td>
                      <td className="text-muted px-4 py-2.5 text-right font-mono">
                        {line.code}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-line border-t-2">
              <td colSpan={2} className="px-4 py-2.5 text-sm font-bold">
                Net Pay
              </td>
              <td
                colSpan={2}
                className="px-4 py-2.5 text-right font-mono text-sm font-bold"
              >
                {formatINR(payslip.netAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}
