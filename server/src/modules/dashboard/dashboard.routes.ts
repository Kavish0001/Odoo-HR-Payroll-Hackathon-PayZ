import {
  dashboardQuerySchema,
  isBlockingWarning,
  PAYSLIP_STATUSES,
  type AttendanceOverview,
  type DashboardData,
  type DashboardKpis,
  type DashboardQuery,
  type DepartmentSalaryPoint,
  type PayrollAlert,
  type PayslipStatus,
  type SalaryTrendPoint,
  type TimeOffOverviewRow,
} from '@payz/shared';
import { type Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncRoute } from '../common/async-route.js';

export const dashboardRouter: Router = Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TREND_PERIODS = 6;

interface Period {
  start: Date;
  end: Date;
}

/**
 * The selected window. When the caller does not pin both ends, the dashboard
 * falls back to the most recently finalised payroll period so the screen
 * never opens on an empty draft month (September 2026 in the seed has no
 * payslips yet).
 */
async function resolvePeriod(query: DashboardQuery): Promise<Period | null> {
  if (query.periodStart !== undefined && query.periodEnd !== undefined) {
    return { start: query.periodStart, end: query.periodEnd };
  }

  const latest = await prisma.payrun.findFirst({
    where: { status: { not: 'DRAFT' } },
    orderBy: { periodEnd: 'desc' },
    select: { periodStart: true, periodEnd: true },
  });

  return latest === null
    ? null
    : { start: latest.periodStart, end: latest.periodEnd };
}

/** An equal-length window immediately before `period`, for the KPI delta. */
function previousPeriodOf(period: Period): Period {
  const durationMs = period.end.getTime() - period.start.getTime();
  const end = new Date(period.start.getTime() - MS_PER_DAY);
  const start = new Date(end.getTime() - durationMs);
  return { start, end };
}

function employeeFilter(query: DashboardQuery): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = {};
  if (query.departmentId !== undefined) {
    where.departmentId = query.departmentId;
  }
  if (query.employeeType !== undefined) {
    where.employeeType = query.employeeType;
  }
  return where;
}

/** Working (Mon–Fri) days between two dates, inclusive on both ends. */
function countWorkingDays(period: Period): number {
  let count = 0;
  const cursor = new Date(period.start);
  while (cursor.getTime() <= period.end.getTime()) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function emptyDashboard(): DashboardData {
  const timeOffTypesEmpty: TimeOffOverviewRow[] = [];
  const emptyStatusSplit: { status: PayslipStatus; count: number }[] =
    PAYSLIP_STATUSES.map((status) => ({ status, count: 0 }));

  return {
    kpis: {
      totalNetPaid: 0,
      totalNetPreviousPeriod: 0,
      payslipsGenerated: 0,
      payslipsPaid: 0,
      payslipsPending: 0,
      averageSalary: 0,
      approvedTimeOffDays: 0,
      attendanceHealth: 0,
      headcount: 0,
    },
    salaryByDepartment: [],
    salaryTrend: [],
    payslipStatusSplit: emptyStatusSplit,
    alerts: [],
    attendance: {
      present: 0,
      late: 0,
      absent: 0,
      overtimeHours: 0,
      missingCheckouts: 0,
      manualEdits: 0,
      coverage: 0,
    },
    timeOff: timeOffTypesEmpty,
    departments: [],
  };
}

/**
 * Net salary and department split for a window, in one pass over the
 * matching payslips. 140 payslips total in the seed, so fetching the rows for
 * a window and reducing in memory is cheaper (and clearer) than a second
 * round trip per figure.
 */
async function loadPayslipFigures(
  period: Period,
  employeeWhere: Prisma.EmployeeWhereInput,
): Promise<{
  totalNet: number;
  generated: number;
  paid: number;
  departmentTotals: Map<number, { name: string; total: number }>;
  statusCounts: Map<PayslipStatus, number>;
}> {
  const rows = await prisma.payslip.findMany({
    where: {
      periodStart: { gte: period.start },
      periodEnd: { lte: period.end },
      employee: employeeWhere,
    },
    select: {
      netAmount: true,
      status: true,
      employee: {
        select: { departmentId: true, department: { select: { name: true } } },
      },
    },
  });

  let totalNet = 0;
  let paid = 0;
  const departmentTotals = new Map<number, { name: string; total: number }>();
  const statusCounts = new Map<PayslipStatus, number>();

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

    if (row.status === 'CANCELLED') {
      continue;
    }

    totalNet += row.netAmount;
    if (row.status === 'PAID') {
      paid += 1;
    }

    const departmentId = row.employee.departmentId;
    if (departmentId !== null) {
      const departmentName = row.employee.department?.name ?? 'Unassigned';
      const existing = departmentTotals.get(departmentId);
      if (existing === undefined) {
        departmentTotals.set(departmentId, {
          name: departmentName,
          total: row.netAmount,
        });
      } else {
        existing.total += row.netAmount;
      }
    }
  }

  const generated = rows.filter((row) => row.status !== 'CANCELLED').length;

  return { totalNet, generated, paid, departmentTotals, statusCounts };
}

async function loadDepartmentPoints(
  query: DashboardQuery,
  employeeWhere: Prisma.EmployeeWhereInput,
  departmentTotals: Map<number, { name: string; total: number }>,
): Promise<DepartmentSalaryPoint[]> {
  const [departments, headcounts] = await Promise.all([
    prisma.department.findMany({
      where: query.departmentId !== undefined ? { id: query.departmentId } : {},
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { ...employeeWhere, active: true, departmentId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const headcountMap = new Map<number, number>();
  for (const row of headcounts) {
    if (row.departmentId !== null) {
      headcountMap.set(row.departmentId, row._count._all);
    }
  }

  return departments.map((department) => ({
    departmentId: String(department.id),
    departmentName: department.name,
    headcount: headcountMap.get(department.id) ?? 0,
    totalNet: departmentTotals.get(department.id)?.total ?? 0,
  }));
}

async function loadSalaryTrend(
  period: Period,
  employeeWhere: Prisma.EmployeeWhereInput,
): Promise<SalaryTrendPoint[]> {
  const payruns = await prisma.payrun.findMany({
    where: { status: { not: 'DRAFT' }, periodEnd: { lte: period.end } },
    orderBy: { periodStart: 'desc' },
    take: TREND_PERIODS,
    select: { id: true, name: true, periodStart: true },
  });

  if (payruns.length === 0) {
    return [];
  }

  const totals = await prisma.payslip.groupBy({
    by: ['payrunId'],
    where: {
      payrunId: { in: payruns.map((payrun) => payrun.id) },
      status: { not: 'CANCELLED' },
      employee: employeeWhere,
    },
    _sum: { netAmount: true },
    _count: { _all: true },
  });

  const totalsMap = new Map(totals.map((row) => [row.payrunId, row]));

  return [...payruns].reverse().map((payrun) => {
    const total = totalsMap.get(payrun.id);
    return {
      period: payrun.name,
      periodStart: payrun.periodStart.toISOString(),
      totalNet: total?._sum.netAmount ?? 0,
      payslipCount: total?._count._all ?? 0,
    };
  });
}

async function loadAlerts(
  query: DashboardQuery,
  period: Period,
  employeeWhere: Prisma.EmployeeWhereInput,
): Promise<PayrollAlert[]> {
  const hasEmployeeFilter =
    query.departmentId !== undefined || query.employeeType !== undefined;

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * MS_PER_DAY);

  const duplicateWhere: Prisma.PayrollWarningWhereInput = {
    code: 'DUPLICATE_PAYSLIP',
    payrun: {
      periodStart: { gte: period.start },
      periodEnd: { lte: period.end },
    },
  };
  if (hasEmployeeFilter) {
    duplicateWhere.payslip = { employee: employeeWhere };
  }

  const draftWhere: Prisma.PayrunWhereInput = { status: 'DRAFT' };
  if (query.periodStart !== undefined && query.periodEnd !== undefined) {
    draftWhere.periodStart = query.periodStart;
    draftWhere.periodEnd = query.periodEnd;
  }

  const [missingBank, duplicatePayslips, draftPayruns, expiringContracts] =
    await Promise.all([
      prisma.employee.count({
        where: { ...employeeWhere, active: true, bankAccount: null },
      }),
      prisma.payrollWarning.count({ where: duplicateWhere }),
      prisma.payrun.count({ where: draftWhere }),
      prisma.contract.count({
        where: {
          status: 'RUNNING',
          endDate: { not: null, gte: now, lte: in30Days },
          employee: employeeWhere,
        },
      }),
    ]);

  const alerts: PayrollAlert[] = [
    {
      code: 'MISSING_BANK_ACCOUNT',
      message: 'Employees missing bank account details',
      count: missingBank,
      severity: isBlockingWarning('MISSING_BANK_ACCOUNT')
        ? 'blocking'
        : 'advisory',
    },
    {
      code: 'DUPLICATE_PAYSLIP',
      message: 'Duplicate payslip warnings on record',
      count: duplicatePayslips,
      severity: isBlockingWarning('DUPLICATE_PAYSLIP')
        ? 'blocking'
        : 'advisory',
    },
    {
      code: 'DRAFT_NOT_VALIDATED',
      message: 'Payruns still in draft, not yet validated',
      count: draftPayruns,
      severity: 'advisory',
    },
    {
      code: 'CONTRACT_EXPIRING',
      message: 'Contracts expiring within 30 days',
      count: expiringContracts,
      severity: isBlockingWarning('CONTRACT_EXPIRING')
        ? 'blocking'
        : 'advisory',
    },
  ];

  return alerts;
}

async function loadAttendance(
  period: Period,
  employeeWhere: Prisma.EmployeeWhereInput,
  headcount: number,
): Promise<AttendanceOverview> {
  const where: Prisma.AttendanceWhereInput = {
    employee: employeeWhere,
    checkIn: {
      gte: period.start,
      lt: new Date(period.end.getTime() + MS_PER_DAY),
    },
  };

  const [statusCounts, overtime, manualEdits] = await Promise.all([
    prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.attendance.aggregate({ where, _sum: { overtimeMinutes: true } }),
    prisma.attendance.count({ where: { ...where, source: 'MANUAL' } }),
  ]);

  const byStatus = new Map(
    statusCounts.map((row) => [row.status, row._count._all]),
  );
  const present = byStatus.get('PRESENT') ?? 0;
  const late = byStatus.get('LATE') ?? 0;
  const absent = byStatus.get('ABSENT') ?? 0;
  const missingCheckouts = byStatus.get('MISSING_CHECKOUT') ?? 0;
  const totalRecords = present + late + absent + missingCheckouts;

  const expectedRecords = headcount * countWorkingDays(period);
  const coverage =
    expectedRecords === 0
      ? 0
      : Math.round((totalRecords / expectedRecords) * 100);

  return {
    present,
    late,
    absent,
    overtimeHours:
      Math.round(((overtime._sum.overtimeMinutes ?? 0) / 60) * 10) / 10,
    missingCheckouts,
    manualEdits,
    coverage,
  };
}

async function loadTimeOff(
  period: Period,
  employeeWhere: Prisma.EmployeeWhereInput,
): Promise<{ rows: TimeOffOverviewRow[]; approvedDaysTotal: number }> {
  const types = await prisma.timeOffType.findMany({
    select: { id: true, name: true, unit: true, requiresAllocation: true },
    orderBy: { name: 'asc' },
  });

  const overlapsPeriod: Prisma.TimeOffRequestWhereInput = {
    startDate: { lte: period.end },
    endDate: { gte: period.start },
  };

  const [approvedInPeriod, pendingInPeriod, allocated, usedAllTime] =
    await Promise.all([
      prisma.timeOffRequest.groupBy({
        by: ['typeId'],
        where: {
          ...overlapsPeriod,
          status: 'APPROVED',
          employee: employeeWhere,
        },
        _sum: { duration: true },
      }),
      prisma.timeOffRequest.groupBy({
        by: ['typeId'],
        where: {
          ...overlapsPeriod,
          status: 'TO_APPROVE',
          employee: employeeWhere,
        },
        _count: { _all: true },
      }),
      prisma.timeOffAllocation.groupBy({
        by: ['typeId'],
        where: { status: 'APPROVED', employee: employeeWhere },
        _sum: { allocatedQty: true },
      }),
      // Balance is a running total, not scoped to the selected window.
      prisma.timeOffRequest.groupBy({
        by: ['typeId'],
        where: { status: 'APPROVED', employee: employeeWhere },
        _sum: { duration: true },
      }),
    ]);

  const approvedMap = new Map(
    approvedInPeriod.map((row) => [row.typeId, row._sum.duration ?? 0]),
  );
  const pendingMap = new Map(
    pendingInPeriod.map((row) => [row.typeId, row._count._all]),
  );
  const allocatedMap = new Map(
    allocated.map((row) => [row.typeId, row._sum.allocatedQty ?? 0]),
  );
  const usedMap = new Map(
    usedAllTime.map((row) => [row.typeId, row._sum.duration ?? 0]),
  );

  let approvedDaysTotal = 0;
  const rows: TimeOffOverviewRow[] = types.map((type) => {
    const approvedDays = approvedMap.get(type.id) ?? 0;
    if (type.unit === 'DAYS') {
      approvedDaysTotal += approvedDays;
    }

    return {
      typeId: String(type.id),
      typeName: type.name,
      approvedDays,
      pending: pendingMap.get(type.id) ?? 0,
      remainingBalance: type.requiresAllocation
        ? (allocatedMap.get(type.id) ?? 0) - (usedMap.get(type.id) ?? 0)
        : null,
    };
  });

  return { rows, approvedDaysTotal };
}

async function buildDashboard(query: DashboardQuery): Promise<DashboardData> {
  const period = await resolvePeriod(query);
  if (period === null) {
    return emptyDashboard();
  }

  const previousPeriod = previousPeriodOf(period);
  const employeeWhere = employeeFilter(query);

  const [current, previous, headcount, salaryTrend, alerts, timeOff] =
    await Promise.all([
      loadPayslipFigures(period, employeeWhere),
      loadPayslipFigures(previousPeriod, employeeWhere),
      prisma.employee.count({ where: { ...employeeWhere, active: true } }),
      loadSalaryTrend(period, employeeWhere),
      loadAlerts(query, period, employeeWhere),
      loadTimeOff(period, employeeWhere),
    ]);

  const [departmentPoints, attendance] = await Promise.all([
    loadDepartmentPoints(query, employeeWhere, current.departmentTotals),
    loadAttendance(period, employeeWhere, headcount),
  ]);

  const payslipStatusSplit = PAYSLIP_STATUSES.map((status) => ({
    status,
    count: current.statusCounts.get(status) ?? 0,
  }));

  const kpis: DashboardKpis = {
    totalNetPaid: current.totalNet,
    totalNetPreviousPeriod: previous.totalNet,
    payslipsGenerated: current.generated,
    payslipsPaid: current.paid,
    payslipsPending: current.generated - current.paid,
    averageSalary:
      current.generated === 0
        ? 0
        : Math.round(current.totalNet / current.generated),
    approvedTimeOffDays: timeOff.approvedDaysTotal,
    attendanceHealth:
      attendance.present +
        attendance.late +
        attendance.absent +
        attendance.missingCheckouts ===
      0
        ? 0
        : Math.round(
            ((attendance.present + attendance.late) /
              (attendance.present +
                attendance.late +
                attendance.absent +
                attendance.missingCheckouts)) *
              100,
          ),
    headcount,
  };

  return {
    kpis,
    salaryByDepartment: departmentPoints,
    salaryTrend,
    payslipStatusSplit,
    alerts,
    attendance,
    timeOff: timeOff.rows,
    departments: departmentPoints,
  };
}

dashboardRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'dashboard'),
  validate({ query: dashboardQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as DashboardQuery;
    const data = await buildDashboard(query);
    res.json(data);
  }),
);
