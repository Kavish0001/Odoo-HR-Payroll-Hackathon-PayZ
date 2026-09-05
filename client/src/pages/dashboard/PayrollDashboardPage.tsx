import {
  EMPLOYEE_TYPES,
  formatINR,
  formatINRCompact,
  type EmployeeType,
} from '@payz/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { toApiError } from '../../api/client.js';
import { useCompanies } from '../../api/companies.js';
import { useDashboard } from '../../api/dashboard.js';
import { useDepartments } from '../../api/departments.js';
import { PayslipStatusChart } from '../../components/charts/PayslipStatusChart.js';
import { SalaryByDepartmentChart } from '../../components/charts/SalaryByDepartmentChart.js';
import { SalaryTrendChart } from '../../components/charts/SalaryTrendChart.js';
import { PageHeader } from '../../components/data/PageHeader.js';
import { StatusBadge } from '../../components/data/StatusBadge.js';
import { Card } from '../../components/ui/Card.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';

import { KpiCard, KpiCardSkeleton } from './KpiCard.js';
import { Panel, PanelSkeleton } from './Panel.js';

/** "FULL_TIME" -> "Full Time". */
function humanize(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

const EMPLOYEE_TYPE_OPTIONS = EMPLOYEE_TYPES.map((type) => ({
  value: type,
  label: humanize(type),
}));

function isEmployeeType(value: string): value is EmployeeType {
  return (EMPLOYEE_TYPES as readonly string[]).includes(value);
}

function formatDays(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} days`;
}

/**
 * The Payroll Dashboard, `/payroll/dashboard` in the wireframe (mounted by
 * the controller at `/dashboard`). Every figure comes from `GET /api/dashboard`
 * — nothing here is a constant.
 */
export function PayrollDashboardPage(): React.JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const periodStart = searchParams.get('periodStart') ?? '';
  const periodEnd = searchParams.get('periodEnd') ?? '';
  const companyId = searchParams.get('companyId') ?? '';
  const departmentId = searchParams.get('departmentId') ?? '';
  const employeeTypeParam = searchParams.get('employeeType') ?? '';
  const employeeType = isEmployeeType(employeeTypeParam)
    ? employeeTypeParam
    : undefined;

  const setParam = (key: string, value: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  };

  const companiesQuery = useCompanies();
  const companyOptions = useMemo(
    () =>
      (companiesQuery.data ?? []).map((company) => ({
        value: company.id,
        label: company.name,
      })),
    [companiesQuery.data],
  );

  const departmentsQuery = useDepartments({ pageSize: 200 });
  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data?.rows ?? []).map((department) => ({
        value: department.id,
        label: department.name,
      })),
    [departmentsQuery.data],
  );

  const dashboardQuery = useDashboard({
    periodStart: periodStart === '' ? undefined : periodStart,
    periodEnd: periodEnd === '' ? undefined : periodEnd,
    companyId: companyId === '' ? undefined : companyId,
    departmentId: departmentId === '' ? undefined : departmentId,
    employeeType,
  });

  const data = dashboardQuery.data;
  const isEmpty =
    data?.kpis.headcount === 0 &&
    data.kpis.payslipsGenerated === 0 &&
    data.salaryByDepartment.length === 0;

  const netDelta =
    data === undefined || data.kpis.totalNetPreviousPeriod === 0
      ? null
      : ((data.kpis.totalNetPaid - data.kpis.totalNetPreviousPeriod) /
          data.kpis.totalNetPreviousPeriod) *
        100;

  const activeAlerts = data?.alerts.filter((alert) => alert.count > 0) ?? [];

  return (
    <div>
      <PageHeader
        title="Payroll Dashboard"
        subtitle={
          data !== undefined
            ? `${String(data.kpis.headcount)} employees in scope for the selected filters.`
            : 'Aggregated payroll, attendance and time-off figures.'
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Field
          label="Period start"
          htmlFor="dashboard-period-start"
          className="w-40"
        >
          <Input
            id="dashboard-period-start"
            type="date"
            value={periodStart}
            onChange={(event) => {
              setParam('periodStart', event.target.value);
            }}
          />
        </Field>
        <Field
          label="Period end"
          htmlFor="dashboard-period-end"
          className="w-40"
        >
          <Input
            id="dashboard-period-end"
            type="date"
            value={periodEnd}
            onChange={(event) => {
              setParam('periodEnd', event.target.value);
            }}
          />
        </Field>
        <Field
          label="Department"
          htmlFor="dashboard-department"
          className="w-48"
        >
          <Select
            id="dashboard-department"
            value={departmentId}
            onChange={(event) => {
              setParam('departmentId', event.target.value);
            }}
            options={departmentOptions}
            placeholder="All departments"
          />
        </Field>
        <Field
          label="Employee type"
          htmlFor="dashboard-employee-type"
          className="w-44"
        >
          <Select
            id="dashboard-employee-type"
            value={employeeTypeParam}
            onChange={(event) => {
              setParam('employeeType', event.target.value);
            }}
            options={EMPLOYEE_TYPE_OPTIONS}
            placeholder="All types"
          />
        </Field>
        <Field label="Company" htmlFor="dashboard-company" className="w-44">
          {/* Named from the database rather than labelled "All Companies",
              which told nobody whose payroll they were looking at. Most
              deployments have one company, and then this reads as a caption;
              it filters for real when there is more than one. */}
          <Select
            id="dashboard-company"
            value={companyId}
            onChange={(event) => {
              setParam('companyId', event.target.value);
            }}
            options={companyOptions}
            placeholder="All companies"
            disabled={companyOptions.length === 0}
          />
        </Field>
      </Card>

      {dashboardQuery.isError && (
        <Card className="border-danger-line bg-danger-soft mb-4 p-4">
          <p className="text-danger text-sm font-medium">
            {toApiError(dashboardQuery.error).message ||
              'Could not load the dashboard. The API may still be starting up.'}
          </p>
        </Card>
      )}

      {dashboardQuery.isLoading && (
        <div className="space-y-4">
          <div className="border-steel-300 brushed divide-steel-300 grid grid-cols-1 divide-y rounded-sm border sm:grid-cols-2 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
            {Array.from({ length: 5 }).map((_, index) => (
              <KpiCardSkeleton key={index} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
          <PanelSkeleton height={160} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PanelSkeleton height={200} />
            <PanelSkeleton height={200} />
          </div>
        </div>
      )}

      {data !== undefined && isEmpty && (
        <Card className="p-10 text-center">
          <p className="text-sm font-semibold">
            No payroll data for this period
          </p>
          <p className="text-muted mt-1 text-xs">
            Try a wider period, or clear the department and employee type
            filters.
          </p>
        </Card>
      )}

      {data !== undefined && !isEmpty && (
        <div className="space-y-4">
          <div className="border-steel-300 brushed divide-steel-300 grid grid-cols-1 divide-y rounded-sm border sm:grid-cols-2 sm:divide-x lg:grid-cols-5 lg:divide-y-0">
            <KpiCard
              primary
              label="Total Net Salary Paid"
              value={formatINRCompact(data.kpis.totalNetPaid)}
              tone={
                netDelta === null ? 'neutral' : netDelta >= 0 ? 'up' : 'down'
              }
              sublabel={
                netDelta === null
                  ? 'No prior period to compare'
                  : `${netDelta >= 0 ? '+' : ''}${netDelta.toFixed(1)}% vs previous period`
              }
            />
            <KpiCard
              label="Payslips Generated"
              value={String(data.kpis.payslipsGenerated)}
              sublabel={`${String(data.kpis.payslipsPaid)} paid • ${String(data.kpis.payslipsPending)} pending`}
            />
            <KpiCard
              label="Avg Salary / Employee"
              value={formatINRCompact(data.kpis.averageSalary)}
              sublabel="Per payslip, this period"
            />
            <KpiCard
              label="Approved Time Off"
              value={formatDays(data.kpis.approvedTimeOffDays)}
              sublabel="Approved, this period"
            />
            <KpiCard
              label="Attendance Health"
              value={`${String(data.kpis.attendanceHealth)}%`}
              sublabel="Present + late, of all records"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Salary Cost by Department">
              {data.salaryByDepartment.length === 0 ? (
                <EmptyPanelNote text="No departments match the current filters." />
              ) : (
                <SalaryByDepartmentChart data={data.salaryByDepartment} />
              )}
            </Panel>
            <Panel title="Monthly Net Salary Trend">
              {data.salaryTrend.length === 0 ? (
                <EmptyPanelNote text="No finalised payroll periods yet." />
              ) : (
                <SalaryTrendChart data={data.salaryTrend} />
              )}
            </Panel>
          </div>

          <Panel title="Payslip Status & Payroll Alerts">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="eyebrow mb-2">Status split</h3>
                <PayslipStatusChart data={data.payslipStatusSplit} />
              </div>
              <div>
                <h3 className="eyebrow mb-2">Alerts</h3>
                {activeAlerts.length === 0 ? (
                  <p className="text-muted text-xs">
                    No active payroll alerts.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {activeAlerts.map((alert) => (
                      <li
                        key={alert.code}
                        className="border-steel-300 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={alert.severity}
                            tone={
                              alert.severity === 'blocking'
                                ? 'danger'
                                : 'warning'
                            }
                            dot
                          />
                          <span className="text-sm">{alert.message}</span>
                        </div>
                        <span className="font-mono text-sm font-semibold">
                          {alert.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Attendance Overview">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AttendanceStat
                label="Present"
                value={String(data.attendance.present)}
              />
              <AttendanceStat
                label="Late"
                value={String(data.attendance.late)}
              />
              <AttendanceStat
                label="Absent"
                value={String(data.attendance.absent)}
              />
              <AttendanceStat
                label="Overtime"
                value={`${String(data.attendance.overtimeHours)}h`}
              />
              <AttendanceStat
                label="Missing Check-outs"
                value={String(data.attendance.missingCheckouts)}
              />
              <AttendanceStat
                label="Manual Edits"
                value={String(data.attendance.manualEdits)}
              />
              <AttendanceStat
                label="Coverage"
                value={`${String(data.attendance.coverage)}%`}
              />
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Time Off Overview" className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="eyebrow border-steel-300 border-b text-left">
                      <th className="py-1.5 pr-2 font-medium">Type</th>
                      <th className="py-1.5 pr-2 font-medium">Approved Days</th>
                      <th className="py-1.5 pr-2 font-medium">Pending</th>
                      <th className="py-1.5 font-medium">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeOff.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-muted py-4 text-center text-xs"
                        >
                          No time off types configured.
                        </td>
                      </tr>
                    ) : (
                      data.timeOff.map((row) => (
                        <tr
                          key={row.typeId}
                          className="border-steel-300/60 border-b last:border-0"
                        >
                          <td className="py-1.5 pr-2">{row.typeName}</td>
                          <td className="font-mono py-1.5 pr-2">
                            {row.approvedDays % 1 === 0
                              ? row.approvedDays.toFixed(0)
                              : row.approvedDays.toFixed(1)}
                          </td>
                          <td className="font-mono py-1.5 pr-2">
                            {row.pending}
                          </td>
                          <td className="font-mono py-1.5">
                            {row.remainingBalance === null
                              ? 'N/A'
                              : row.remainingBalance.toFixed(1)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Department Overview" className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="eyebrow border-steel-300 border-b text-left">
                      <th className="py-1.5 pr-2 font-medium">Department</th>
                      <th className="py-1.5 pr-2 font-medium">Headcount</th>
                      <th className="py-1.5 font-medium">Monthly Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-muted py-4 text-center text-xs"
                        >
                          No departments match the current filters.
                        </td>
                      </tr>
                    ) : (
                      data.departments.map((department) => (
                        <tr
                          key={department.departmentId}
                          className="border-steel-300/60 border-b last:border-0"
                        >
                          <td className="py-1.5 pr-2">
                            {department.departmentName}
                          </td>
                          <td className="font-mono py-1.5 pr-2">
                            {department.headcount}
                          </td>
                          <td className="font-mono py-1.5">
                            {formatINR(department.totalNet)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="border-steel-300 rounded-md border px-3 py-2.5">
      <p className="eyebrow">{label}</p>
      <p className="font-mono mt-1 text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function EmptyPanelNote({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex h-[220px] items-center justify-center text-center">
      <p className="text-muted text-xs">{text}</p>
    </div>
  );
}
