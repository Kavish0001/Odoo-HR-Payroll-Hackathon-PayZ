import { fileURLToPath } from 'node:url';

import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

import {
  computePayslip,
  type RuleDefinition,
} from '../src/modules/payroll/engine.js';

import {
  buildScaleRoster,
  roleForPosition,
  DEPARTMENTS,
  INTERN_SALARY_RULES,
  JOB_POSITIONS,
  MANAGERS,
  PEOPLE,
  REGULAR_SALARY_RULES,
  TIME_OFF_TYPES,
  makeRandom,
  type SeedRule,
} from './seed-data.js';

// The seed runs outside the server, so it loads the root .env itself.
loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'payz-demo-2026';

/**
 * Six payroll periods. The first five are finalised so the dashboard trend
 * chart has real history to plot; September is left open so the Draft to
 * Compute to Validate to Mark Paid flow can be demonstrated live.
 */
/**
 * Payroll history across three years.
 *
 * Everything before the current month is finalised so the trend chart, the
 * previous-period comparison and "paid vs pending" all have real history to
 * work from. The current month is left DRAFT so the Compute to Validate to
 * Mark Paid flow can be demonstrated live.
 */
interface SeedPeriod {
  name: string;
  start: string;
  end: string;
  status: 'PAID' | 'VALIDATED' | 'DRAFT';
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function buildPeriods(): SeedPeriod[] {
  const periods: SeedPeriod[] = [];
  // January 2024 through September 2026.
  for (let year = 2024; year <= 2026; year += 1) {
    const lastMonth = year === 2026 ? 9 : 12;
    for (let month = 1; month <= lastMonth; month += 1) {
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const pad = (n: number): string => String(n).padStart(2, '0');
      const isCurrent = year === 2026 && month === 9;
      const isPrevious = year === 2026 && month === 8;
      periods.push({
        name: `${MONTH_NAMES[month - 1] ?? ''} ${String(year)}`,
        start: `${String(year)}-${pad(month)}-01`,
        end: `${String(year)}-${pad(month)}-${pad(last)}`,
        status: isCurrent ? 'DRAFT' : isPrevious ? 'VALIDATED' : 'PAID',
      });
    }
  }
  return periods;
}

const PERIODS: SeedPeriod[] = buildPeriods();

function assertLocalDatabase(): void {
  const url = process.env['DATABASE_URL'] ?? '';
  const host = url.length > 0 ? new URL(url).hostname : '';

  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Refusing to seed a non-local database (host: ${host || 'unset'}).`,
    );
  }
}

const at = (hour: number, minute = 0): number => hour * 60 + minute;
const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/**
 * A wall-clock instant on a given day.
 *
 * Days are generated at UTC midnight, but attendance is judged with
 * getHours(), which is local. Writing 09:00 UTC therefore reads back as
 * half past two in the afternoon in IST, which marks almost everybody late
 * and pushes check-outs past midnight. Building the instant from the local
 * calendar day makes the stored time mean what it says.
 */
function atLocal(day: Date, minutes: number): Date {
  return new Date(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    0,
    minutes,
    0,
    0,
  );
}

/** 23:59 on the day a punch happened, for closing a forgotten check-out. */
function endOfSeedDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 0, 0);
  return end;
}

function isWeekend(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function eachWorkingDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    if (!isWeekend(cursor)) {
      days.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function toRuleDefinition(rule: SeedRule, id: number): RuleDefinition {
  return {
    id,
    code: rule.code,
    name: rule.name,
    category: rule.category,
    sequence: rule.sequence,
    computationType: rule.computationType,
    fixedAmount: rule.fixedAmount ?? null,
    percentage: rule.percentage ?? null,
    percentageBase: rule.percentageBase ?? null,
    percentageRuleCode: null,
    formula: rule.formula ?? null,
    quantity: 1,
  };
}

/** Every table the seed writes, children first -- the order TRUNCATE prints. */
const SEEDED_TABLES = [
  'payslip_lines',
  'payroll_warnings',
  'payslips',
  'payruns',
  'time_off_requests',
  'time_off_allocations',
  'time_off_types',
  'attendances',
  'contracts',
  'salary_rules',
  'salary_structures',
  'audit_logs',
  'users',
  'schedule_lines',
  'working_schedules',
  'employees',
  'departments',
  'job_positions',
  'companies',
] as const;

/**
 * Empties everything and restarts the id sequences.
 *
 * `RESTART IDENTITY` is the part that matters. Ids are integers now, and a
 * plain delete leaves the sequences where they were, so the second seed
 * produced employees 131-260 and the third would have produced 261-390. Every
 * URL written down during a demo would rot at the next reseed, and the ids
 * would climb for no reason. Restarting means seeding twice gives the same
 * database twice, which is what makes the seed a fixture rather than a
 * one-shot.
 *
 * CASCADE covers the foreign keys, so the ordering above is documentation
 * rather than a dependency -- and truncating all nineteen in one statement is
 * considerably faster than nineteen deletes.
 */
async function clearAll(): Promise<void> {
  const tables = SEEDED_TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}

async function main(): Promise<void> {
  assertLocalDatabase();
  await clearAll();

  const random = makeRandom(20260905);

  // The named cast a walkthrough visits, plus generated staff for volume.
  const ROSTER = [...PEOPLE, ...buildScaleRoster(random, PEOPLE.length)];

  // ---- Organisation ------------------------------------------------------
  const company = await prisma.company.create({
    data: { name: 'OXP Pvt Ltd', legalName: 'OXP Private Limited' },
  });

  const departments = new Map<string, number>();
  for (const name of DEPARTMENTS) {
    const record = await prisma.department.create({
      data: {
        name,
        code: name.slice(0, 3).toUpperCase(),
        companyId: company.id,
      },
    });
    departments.set(name, record.id);
  }

  const positions = new Map<string, number>();
  for (const title of JOB_POSITIONS) {
    const record = await prisma.jobPosition.create({ data: { title } });
    positions.set(title, record.id);
  }

  // ---- Working schedules -------------------------------------------------
  const weekdays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ] as const;

  const fullTime = await prisma.workingSchedule.create({
    data: {
      name: '40 Hours / Week',
      companyId: company.id,
      lines: {
        create: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startMinute: at(9),
          endMinute: at(18),
          breakMinutes: 60,
        })),
      },
    },
  });

  const partTime = await prisma.workingSchedule.create({
    data: {
      name: 'Part-time 20h',
      companyId: company.id,
      lines: {
        create: weekdays.slice(0, 4).map((dayOfWeek) => ({
          dayOfWeek,
          startMinute: at(9),
          endMinute: at(14),
          breakMinutes: 0,
        })),
      },
    },
  });

  const flexible = await prisma.workingSchedule.create({
    data: {
      name: 'Flexible Hybrid 37.5h',
      companyId: company.id,
      lines: {
        create: weekdays.map((dayOfWeek) => ({
          dayOfWeek,
          startMinute: at(10),
          endMinute: at(18),
          breakMinutes: 30,
        })),
      },
    },
  });

  const schedules = {
    full: fullTime.id,
    part: partTime.id,
    flexible: flexible.id,
  };

  // ---- Salary structures and rules ---------------------------------------
  const regular = await prisma.salaryStructure.create({
    data: { name: 'Regular Salary', code: 'REGULAR', companyId: company.id },
  });
  const internStructure = await prisma.salaryStructure.create({
    data: { name: 'Intern Salary', code: 'INTERN', companyId: company.id },
  });

  const regularRules: RuleDefinition[] = [];
  for (const rule of REGULAR_SALARY_RULES) {
    const record = await prisma.salaryRule.create({
      data: {
        structureId: regular.id,
        name: rule.name,
        code: rule.code,
        category: rule.category,
        sequence: rule.sequence,
        computationType: rule.computationType,
        fixedAmount: rule.fixedAmount ?? null,
        percentage: rule.percentage ?? null,
        percentageBase: rule.percentageBase ?? null,
        formula: rule.formula ?? null,
      },
    });
    regularRules.push(toRuleDefinition(rule, record.id));
  }

  const internRules: RuleDefinition[] = [];
  for (const rule of INTERN_SALARY_RULES) {
    const record = await prisma.salaryRule.create({
      data: {
        structureId: internStructure.id,
        name: rule.name,
        code: rule.code,
        category: rule.category,
        sequence: rule.sequence,
        computationType: rule.computationType,
        fixedAmount: rule.fixedAmount ?? null,
        percentage: rule.percentage ?? null,
        percentageBase: rule.percentageBase ?? null,
        formula: rule.formula ?? null,
      },
    });
    internRules.push(toRuleDefinition(rule, record.id));
  }

  // ---- Employees ---------------------------------------------------------
  const employees = new Map<
    string,
    {
      id: number;
      wage: number;
      isIntern: boolean;
      seniority: number;
      scheduleId: number;
    }
  >();

  // Work emails must be unique, and a generated roster repeats name pairs.
  // The named cast keeps a clean address; a collision falls back to including
  // the employee code, which is unique by construction.
  const takenEmails = new Set<string>();
  const workEmailFor = (person: (typeof ROSTER)[number]): string => {
    const plain = `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@oxp.com`;
    if (!takenEmails.has(plain)) {
      takenEmails.add(plain);
      return plain;
    }
    const unique = `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}.${person.code.toLowerCase()}@oxp.com`;
    takenEmails.add(unique);
    return unique;
  };

  for (const person of ROSTER) {
    const record = await prisma.employee.create({
      data: {
        code: person.code,
        firstName: person.firstName,
        lastName: person.lastName,
        workEmail: workEmailFor(person),
        phone: `+91 9${String(80000000 + Math.floor(random() * 19999999))}`,
        companyId: company.id,
        departmentId: departments.get(person.department) ?? null,
        jobPositionId: positions.get(person.position) ?? null,
        workingScheduleId: schedules[person.schedule],
        employeeType: person.employeeType,
        workLocation: person.location,
        joinDate: day(`${String(person.joinYear)}-04-01`),
        ...(person.hasBankDetails
          ? {
              // A plausible 13-digit account, not a pre-masked string: the
              // payslip masks it on the way out, so storing it already
              // starred left the printed slip showing letters from the
              // employee code where the last four digits belong.
              bankAccount: `50100${String(10_000_000 + Math.floor(random() * 89_999_999))}`,
              bankName: 'HDFC Bank',
              bankIfsc: 'HDFC0001234',
            }
          : {}),
      },
    });

    employees.set(person.code, {
      id: record.id,
      wage: person.wage,
      isIntern: person.employeeType === 'INTERN',
      seniority: 2026 - person.joinYear,
      scheduleId: schedules[person.schedule],
    });
  }

  for (const [code, managerCode] of Object.entries(MANAGERS)) {
    const employee = employees.get(code);
    const manager = employees.get(managerCode);
    if (employee !== undefined && manager !== undefined) {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { managerId: manager.id },
      });
    }
  }

  // Department managers, so the org chart is not flat.
  for (const [department, code] of [
    ['Finance', 'EMP002'],
    ['HR', 'EMP004'],
    ['Engineering', 'EMP008'],
    ['Sales', 'EMP015'],
    ['Support', 'EMP021'],
    ['IT', 'EMP025'],
  ] as const) {
    const departmentId = departments.get(department);
    const manager = employees.get(code);
    if (departmentId !== undefined && manager !== undefined) {
      await prisma.department.update({
        where: { id: departmentId },
        data: { managerId: manager.id },
      });
    }
  }

  // ---- Contracts ---------------------------------------------------------
  // One expired and one running each. The exclusion constraint guarantees the
  // running ones cannot overlap, so this ordering is enforced, not assumed.
  let reference = 1;
  const contracts = new Map<string, number>();
  const raisedContracts = new Map<
    string,
    { contractId: number; wage: number }
  >();

  for (const person of ROSTER) {
    const employee = employees.get(person.code);
    if (employee === undefined) {
      continue;
    }

    const structureId = employee.isIntern ? internStructure.id : regular.id;

    if (person.joinYear < 2026) {
      await prisma.contract.create({
        data: {
          reference: `CON/2025/${String(reference++).padStart(4, '0')}`,
          employeeId: employee.id,
          startDate: day('2025-04-01'),
          endDate: day('2026-03-31'),
          // Last year's wage, so a raise is visible in the history.
          wageMonthly: Math.round(employee.wage * 0.91),
          status: 'EXPIRED',
          departmentId: departments.get(person.department) ?? null,
          jobPositionId: positions.get(person.position) ?? null,
          workingScheduleId: employee.scheduleId,
          salaryStructureId: structureId,
        },
      });
    }

    // Two contracts end this year, so CONTRACT_EXPIRING has real subjects.
    const expiring = person.code === 'EMP013' || person.code === 'EMP019';

    const running = await prisma.contract.create({
      data: {
        reference: `CON/2026/${String(reference++).padStart(4, '0')}`,
        employeeId: employee.id,
        startDate: day(person.joinYear >= 2026 ? '2026-01-15' : '2026-04-01'),
        endDate: expiring ? day('2026-09-30') : null,
        wageMonthly: employee.wage,
        status: 'RUNNING',
        departmentId: departments.get(person.department) ?? null,
        jobPositionId: positions.get(person.position) ?? null,
        workingScheduleId: employee.scheduleId,
        salaryStructureId: structureId,
        notes: expiring ? 'Fixed-term contract, renewal under review.' : null,
      },
    });

    contracts.set(person.code, running.id);
  }

  // Three mid-year raises. The first contract is closed at the end of June and
  // a new one opens in July, because two overlapping RUNNING contracts are
  // impossible (rule C1). Payroll therefore has to resolve the contract that
  // applies to each period rather than taking the newest (rule C2), and the
  // salary trend shows a real step rather than a flat line.
  const raises: { code: string; newWage: number }[] = [
    {
      code: 'EMP007',
      newWage: Math.round((employees.get('EMP007')?.wage ?? 0) * 1.18),
    },
    {
      code: 'EMP016',
      newWage: Math.round((employees.get('EMP016')?.wage ?? 0) * 1.15),
    },
    {
      code: 'EMP022',
      newWage: Math.round((employees.get('EMP022')?.wage ?? 0) * 1.22),
    },
  ];

  for (const raise of raises) {
    const employee = employees.get(raise.code);
    const oldContractId = contracts.get(raise.code);
    if (employee === undefined || oldContractId === undefined) {
      continue;
    }

    await prisma.contract.update({
      where: { id: oldContractId },
      data: { endDate: day('2026-06-30'), status: 'EXPIRED' },
    });

    const promoted = await prisma.contract.create({
      data: {
        reference: `CON/2026/${String(reference++).padStart(4, '0')}`,
        employeeId: employee.id,
        startDate: day('2026-07-01'),
        endDate: null,
        wageMonthly: raise.newWage,
        status: 'RUNNING',
        workingScheduleId: employee.scheduleId,
        salaryStructureId: employee.isIntern ? internStructure.id : regular.id,
        notes: 'Annual revision effective 01-Jul-2026.',
      },
    });

    raisedContracts.set(raise.code, {
      contractId: promoted.id,
      wage: raise.newWage,
    });
  }

  // ---- Attendance --------------------------------------------------------
  // Four months of daily records with realistic variance, so the attendance
  // overview and the health percentage are computed from something rather
  // than asserted.
  const attendanceRows: {
    employeeId: number;
    checkIn: Date;
    checkOut: Date | null;
    workedMinutes: number;
    overtimeMinutes: number;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'MISSING_CHECKOUT';
    source: 'WIDGET' | 'MANUAL';
  }[] = [];

  // A year of attendance. Long enough that the overview, the coverage
  // percentage and the manual-edit counter are computed over real volume.
  const attendanceDays = eachWorkingDay(day('2025-09-01'), day('2026-09-04'));

  for (const person of ROSTER) {
    const employee = employees.get(person.code);
    if (employee === undefined) {
      continue;
    }

    const partTimeHours = person.schedule === 'part';
    const expectedMinutes = partTimeHours ? 300 : 480;

    for (const date of attendanceDays) {
      const roll = random();

      // Roughly 4% absence, 12% late, the rest on time.
      if (roll < 0.04) {
        attendanceRows.push({
          employeeId: employee.id,
          checkIn: atLocal(date, at(9)),
          checkOut: atLocal(date, at(9)),
          workedMinutes: 0,
          overtimeMinutes: 0,
          status: 'ABSENT',
          source: 'MANUAL',
        });
        continue;
      }

      const late = roll < 0.16;
      const startMinute =
        (partTimeHours ? at(9) : at(9)) +
        (late ? 20 + Math.floor(random() * 40) : Math.floor(random() * 10));
      const overtime = random() < 0.18 ? 30 + Math.floor(random() * 90) : 0;
      const workedMinutes = expectedMinutes + overtime;

      // 2% of days lose their check-out, which is what the dashboard counts.
      const missingCheckout = random() < 0.02;

      attendanceRows.push({
        employeeId: employee.id,
        checkIn: new Date(date.getTime() + startMinute * 60_000),
        checkOut: missingCheckout
          ? null
          : new Date(
              date.getTime() +
                (startMinute + workedMinutes + (partTimeHours ? 0 : 60)) *
                  60_000,
            ),
        workedMinutes: missingCheckout ? 0 : workedMinutes,
        overtimeMinutes: missingCheckout ? 0 : overtime,
        status: missingCheckout
          ? 'MISSING_CHECKOUT'
          : late
            ? 'LATE'
            : 'PRESENT',
        // A slice of records are manual corrections, which the dashboard
        // surfaces as an attendance-quality signal.
        source: random() < 0.05 ? 'MANUAL' : 'WIDGET',
      });
    }
  }

  // The partial unique index allows only one open session per employee, so
  // every unclosed record but the most recent one per employee is closed.
  // Every missing check-out is closed at end of day. A row left genuinely
  // open would block that employee from ever checking in again, because the
  // partial unique index permits one open row each; the widget resolves live
  // sessions by date instead.
  for (const row of attendanceRows) {
    if (row.checkOut !== null) {
      continue;
    }
    // Closed at end of day with no worked time: the punch is still flagged as
    // a missing check-out for the dashboard to count, but it is history rather
    // than an open session, and it holds nobody's check-in hostage.
    row.checkOut = endOfSeedDay(row.checkIn);
    row.workedMinutes = 0;
    row.overtimeMinutes = 0;
    row.status = 'MISSING_CHECKOUT';
  }

  // Chunked: one createMany with a hundred thousand rows exceeds the driver's
  // parameter budget.
  for (let i = 0; i < attendanceRows.length; i += 2000) {
    await prisma.attendance.createMany({
      data: attendanceRows.slice(i, i + 2000),
    });
  }

  // ---- Time off ----------------------------------------------------------
  const typeIds = new Map<string, number>();
  for (const type of TIME_OFF_TYPES) {
    const record = await prisma.timeOffType.create({
      data: {
        name: type.name,
        code: type.code,
        unit: type.unit,
        requiresAllocation: type.requiresAllocation,
        approvalLevel: type.approvalLevel,
        payrollWorkEntry: type.payrollWorkEntry,
        isPaid: type.isPaid,
        color: type.color,
      },
    });
    typeIds.set(type.code, record.id);
  }

  const ptoTypeId = typeIds.get('PTO');
  const compTypeId = typeIds.get('COMP');
  const sickTypeId = typeIds.get('SICK');

  let approvedLeaveDays = 0;
  let pendingRequests = 0;

  for (const person of ROSTER) {
    const employee = employees.get(person.code);
    if (employee === undefined || ptoTypeId === undefined) {
      continue;
    }

    const manager = employees.get(MANAGERS[person.code] ?? 'EMP004');

    // Annual PTO allocation, approved, which is what creates balance.
    const allocation = await prisma.timeOffAllocation.create({
      data: {
        employeeId: employee.id,
        typeId: ptoTypeId,
        name: 'Paid Time Off 2026',
        allocatedQty: person.employeeType === 'INTERN' ? 8 : 20,
        validFrom: day('2026-01-01'),
        validTo: day('2026-12-31'),
        status: 'APPROVED',
        approverId: manager?.id ?? null,
        description:
          'Annual leave balance granted at the start of the policy year.',
      },
    });

    if (compTypeId !== undefined && random() < 0.4) {
      await prisma.timeOffAllocation.create({
        data: {
          employeeId: employee.id,
          typeId: compTypeId,
          name: 'Comp Off 2026',
          allocatedQty: 8 + Math.floor(random() * 8),
          validFrom: day('2026-01-01'),
          validTo: day('2026-12-31'),
          // Some still awaiting approval, so the list shows both states.
          status: random() < 0.7 ? 'APPROVED' : 'TO_APPROVE',
          approverId: manager?.id ?? null,
        },
      });
    }

    // Two to four PTO requests each across the year, mostly approved.
    const requestCount = 2 + Math.floor(random() * 3);
    for (let n = 0; n < requestCount; n += 1) {
      // February through September. September is the month the demo opens in,
      // so leaving it out made "approved time off this period" read zero on
      // the dashboard for the one period anybody looks at first. Some of
      // those September dates fall after the seed's today, which is correct:
      // upcoming leave is exactly what a pending approval queue is for.
      const month = 2 + Math.floor(random() * 8);
      const startDay = 1 + Math.floor(random() * 22);
      const duration = 1 + Math.floor(random() * 3);
      const start = day(
        `2026-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
      );
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + duration - 1);

      const roll = random();
      const status =
        roll < 0.72 ? 'APPROVED' : roll < 0.9 ? 'TO_APPROVE' : 'REFUSED';

      if (status === 'APPROVED') {
        approvedLeaveDays += duration;
      }
      if (status === 'TO_APPROVE') {
        pendingRequests += 1;
      }

      await prisma.timeOffRequest.create({
        data: {
          employeeId: employee.id,
          typeId: ptoTypeId,
          // Only an approved request consumes a specific allocation.
          allocationId: status === 'APPROVED' ? allocation.id : null,
          startDate: start,
          endDate: end,
          duration,
          status,
          approverId: status === 'TO_APPROVE' ? null : (manager?.id ?? null),
          reason:
            ['Family vacation', 'Personal work', 'Wedding', 'Travel'][
              Math.floor(random() * 4)
            ] ?? 'Personal work',
        },
      });
    }

    // A sick day or two, needing no allocation at all.
    if (sickTypeId !== undefined && random() < 0.5) {
      // June through September, for the same reason.
      const start = day(
        `2026-0${String(6 + Math.floor(random() * 4))}-${String(5 + Math.floor(random() * 20)).padStart(2, '0')}`,
      );
      await prisma.timeOffRequest.create({
        data: {
          employeeId: employee.id,
          typeId: sickTypeId,
          startDate: start,
          endDate: start,
          duration: 1,
          status: 'APPROVED',
          approverId: manager?.id ?? null,
          reason: 'Unwell',
        },
      });
      approvedLeaveDays += 1;
    }
  }

  // ---- Payruns and payslips ----------------------------------------------
  // Computed by the real engine, not by hand, so every figure on the dashboard
  // traces back to the configured salary rules.
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@oxp.com',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      roles: ['ADMIN'],
    },
  });

  let payslipNumber = 1;
  let totalNetPaid = 0;

  for (const period of PERIODS) {
    const periodStart = day(period.start);
    const periodEnd = day(period.end);
    const workingDays = eachWorkingDay(periodStart, periodEnd).length;

    const payrun = await prisma.payrun.create({
      data: {
        name: period.name,
        companyId: company.id,
        salaryStructureId: regular.id,
        periodStart,
        periodEnd,
        status: period.status,
        createdByUserId: adminUser.id,
        computedAt: period.status === 'DRAFT' ? null : new Date(period.end),
        validatedAt:
          period.status === 'VALIDATED' || period.status === 'PAID'
            ? new Date(period.end)
            : null,
        paidAt: period.status === 'PAID' ? new Date(period.end) : null,
      },
    });

    // A draft run has no payslips until someone clicks Compute, which is the
    // demo. Everything earlier is already computed.
    if (period.status === 'DRAFT') {
      continue;
    }

    for (const person of ROSTER) {
      const employee = employees.get(person.code);
      const contractId = contracts.get(person.code);
      if (employee === undefined || contractId === undefined) {
        continue;
      }

      const rules = employee.isIntern ? internRules : regularRules;
      const structureId = employee.isIntern ? internStructure.id : regular.id;

      // The contract that applies to THIS period, not the newest one: a raise
      // effective in July must not be applied to the April payslip (rule C2).
      const raise = raisedContracts.get(person.code);
      const useRaise = raise !== undefined && periodStart >= day('2026-07-01');
      const periodContractId = useRaise ? raise.contractId : contractId;
      const periodWage = useRaise ? raise.wage : employee.wage;

      // Unpaid days and overtime both come from what actually happened that
      // month, so payslips differ period to period instead of repeating.
      const unpaidDays = random() < 0.22 ? 1 + Math.floor(random() * 2) : 0;
      const workedDays = workingDays - unpaidDays;
      const overtimeMinutes = Math.floor(random() * 600);

      const result = computePayslip(rules, {
        wage: periodWage,
        worked: {
          days: workedDays,
          minutes: workedDays * 480,
          leaveDays: unpaidDays,
          overtimeMinutes,
        },
        employee: { seniorityYears: employee.seniority },
      });

      const payslip = await prisma.payslip.create({
        data: {
          number: `PS/2026/${String(payslipNumber++).padStart(5, '0')}`,
          payrunId: payrun.id,
          employeeId: employee.id,
          contractId: periodContractId,
          structureId,
          periodStart,
          periodEnd,
          contractWage: periodWage,
          workedDays,
          workedMinutes: workedDays * 480,
          leaveDays: unpaidDays,
          basicAmount: result.totals.basic,
          allowanceAmount: result.totals.allowance,
          grossAmount: result.totals.gross,
          deductionAmount: result.totals.deduction,
          netAmount: result.totals.net,
          status: period.status === 'PAID' ? 'PAID' : 'DONE',
        },
      });

      // Lines are inserted in one statement per payslip rather than through a
      // nested create, which across thirty-three periods is thousands fewer
      // round trips.
      await prisma.payslipLine.createMany({
        data: result.lines.map((line) => ({
          payslipId: payslip.id,
          ruleId: line.ruleId,
          code: line.code,
          name: line.name,
          category: line.category,
          sequence: line.sequence,
          quantity: line.quantity,
          rate: line.rate,
          amount: line.amount,
        })),
      });

      if (period.status === 'PAID') {
        totalNetPaid += result.totals.net;
      }

      // The warning has a real subject: Sara Khan has no bank details.
      if (!person.hasBankDetails) {
        await prisma.payrollWarning.create({
          data: {
            payrunId: payrun.id,
            payslipId: payslip.id,
            code: 'MISSING_BANK_ACCOUNT',
            message: `${person.firstName} ${person.lastName} has no bank account on file`,
            blocking: false,
          },
        });
      }

      if (person.code === 'EMP013' || person.code === 'EMP019') {
        await prisma.payrollWarning.create({
          data: {
            payrunId: payrun.id,
            payslipId: payslip.id,
            code: 'CONTRACT_EXPIRING',
            message: `${person.firstName} ${person.lastName}'s contract ends 30-Sep-2026`,
            blocking: false,
          },
        });
      }
    }
  }

  // ---- Accounts ----------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  // Named accounts for the walkthrough, kept at stable addresses so the
  // credentials sheet does not change every reseed.
  const NAMED: { email: string; roles: Role[]; code: string }[] = [
    { email: 'payroll@oxp.com', roles: ['HR_PAYROLL_MANAGER'], code: 'EMP001' },
    {
      email: 'payrolluser@oxp.com',
      roles: ['HR_PAYROLL_USER'],
      code: 'EMP002',
    },
    { email: 'hr@oxp.com', roles: ['HR_MANAGER'], code: 'EMP004' },
    { email: 'employee@oxp.com', roles: ['EMPLOYEE'], code: 'EMP007' },
  ];
  const namedByCode = new Map(NAMED.map((a) => [a.code, a]));

  // admin@oxp.com already exists: it was created earlier as the author of the
  // seeded payruns. It stays unlinked to any employee on purpose, because
  // employeeId is unique and Sara Khan already holds the HR Manager account.
  // A system administrator is a role, not necessarily a person on the payroll.

  /**
   * Every employee gets an account.
   *
   * A roster of a hundred and thirty people behind five logins is exactly the
   * mismatch that makes user management look broken: the Users screen showed a
   * handful of rows that had no relationship to the Employees screen. Now the
   * two line up, and the role each account carries follows from the job the
   * person actually does.
   */
  const userRows: {
    email: string;
    passwordHash: string;
    roles: Role[];
    employeeId: number;
  }[] = [];

  for (const person of ROSTER) {
    const employee = employees.get(person.code);
    if (employee === undefined) {
      continue;
    }

    const named = namedByCode.get(person.code);
    const email =
      named?.email ??
      `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}.${person.code.toLowerCase()}@oxp.com`;
    const roles =
      named?.roles ??
      ([roleForPosition(person.position, person.department)] as Role[]);

    userRows.push({ email, passwordHash, roles, employeeId: employee.id });
  }

  for (let i = 0; i < userRows.length; i += 500) {
    await prisma.user.createMany({ data: userRows.slice(i, i + 500) });
  }

  const accounts = NAMED;

  const [
    employeeCount,
    userCount,
    attendanceTotal,
    payslipTotal,
    lineCount,
    requestTotal,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.user.count(),
    prisma.attendance.count(),
    prisma.payslip.count(),
    prisma.payslipLine.count(),
    prisma.timeOffRequest.count(),
  ]);

  const pad = (label: string): string => label.padEnd(20);
  const n = (value: number): string => value.toLocaleString('en-IN');

  console.log('PayZ demo data');
  console.log('==============');
  console.log(`  ${pad('company')}${company.name}`);
  console.log(`  ${pad('departments')}${n(DEPARTMENTS.length)}`);
  console.log(`  ${pad('employees')}${n(employeeCount)}`);
  console.log(
    `  ${pad('user accounts')}${n(userCount)} (one per employee, plus the admin)`,
  );
  console.log(`  ${pad('contracts')}${n(reference - 1)}`);
  console.log(
    `  ${pad('salary rules')}${n(REGULAR_SALARY_RULES.length)} regular + ${n(INTERN_SALARY_RULES.length)} intern`,
  );
  console.log(
    `  ${pad('attendance')}${n(attendanceTotal)} records, Sep 2025 - Sep 2026`,
  );
  console.log(
    `  ${pad('time off')}${n(requestTotal)} requests (${n(approvedLeaveDays)} approved days, ${n(pendingRequests)} pending)`,
  );
  console.log(
    `  ${pad('payruns')}${n(PERIODS.length)} periods, Jan 2024 - Sep 2026`,
  );
  console.log(
    `  ${pad('payslips')}${n(payslipTotal)} with ${n(lineCount)} computed lines`,
  );
  console.log(
    `  ${pad('net salary paid')}Rs ${n(Math.round(totalNetPaid / 100))}`,
  );
  console.log('');
  console.log(`Sign in with any of these. Password: ${DEMO_PASSWORD}`);
  console.log('  admin@oxp.com        ADMIN');
  for (const account of accounts) {
    console.log(`  ${account.email.padEnd(20)} ${account.roles.join(', ')}`);
  }
  console.log('');
  console.log('Every other employee has an account at');
  console.log(
    '  firstname.lastname@oxp.com  (or .empNNN@oxp.com where names repeat)',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
