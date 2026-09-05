import { fileURLToPath } from 'node:url';

import { PrismaClient, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

import {
  computePayslip,
  type RuleDefinition,
} from '../src/modules/payroll/engine.js';

import {
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
const PERIODS = [
  {
    name: 'April 2026',
    start: '2026-04-01',
    end: '2026-04-30',
    status: 'PAID',
  },
  { name: 'May 2026', start: '2026-05-01', end: '2026-05-31', status: 'PAID' },
  { name: 'June 2026', start: '2026-06-01', end: '2026-06-30', status: 'PAID' },
  { name: 'July 2026', start: '2026-07-01', end: '2026-07-31', status: 'PAID' },
  {
    name: 'August 2026',
    start: '2026-08-01',
    end: '2026-08-31',
    status: 'VALIDATED',
  },
  {
    name: 'September 2026',
    start: '2026-09-01',
    end: '2026-09-30',
    status: 'DRAFT',
  },
] as const;

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

function toRuleDefinition(rule: SeedRule, id: string): RuleDefinition {
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

async function clearAll(): Promise<void> {
  // Children before parents.
  await prisma.payslipLine.deleteMany();
  await prisma.payrollWarning.deleteMany();
  await prisma.payslip.deleteMany();
  await prisma.payrun.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.timeOffAllocation.deleteMany();
  await prisma.timeOffType.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.salaryRule.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.scheduleLine.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.jobPosition.deleteMany();
  await prisma.company.deleteMany();
}

async function main(): Promise<void> {
  assertLocalDatabase();
  await clearAll();

  const random = makeRandom(20260905);

  // ---- Organisation ------------------------------------------------------
  const company = await prisma.company.create({
    data: { name: 'OXP Pvt Ltd', legalName: 'OXP Private Limited' },
  });

  const departments = new Map<string, string>();
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

  const positions = new Map<string, string>();
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
          endMinute: at(18, 30),
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
      id: string;
      wage: number;
      isIntern: boolean;
      seniority: number;
      scheduleId: string;
    }
  >();

  for (const person of PEOPLE) {
    const record = await prisma.employee.create({
      data: {
        code: person.code,
        firstName: person.firstName,
        lastName: person.lastName,
        workEmail: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@oxp.com`,
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
              bankAccount: `XXXXXXXX${person.code.slice(-4)}`,
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
  const contracts = new Map<string, string>();
  const raisedContracts = new Map<
    string,
    { contractId: string; wage: number }
  >();

  for (const person of PEOPLE) {
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
    employeeId: string;
    checkIn: Date;
    checkOut: Date | null;
    workedMinutes: number;
    overtimeMinutes: number;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'MISSING_CHECKOUT';
    source: 'WIDGET' | 'MANUAL';
  }[] = [];

  const attendanceDays = eachWorkingDay(day('2026-06-01'), day('2026-09-04'));

  for (const person of PEOPLE) {
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
          checkIn: new Date(date.getTime() + at(9) * 60_000),
          checkOut: new Date(date.getTime() + at(9) * 60_000),
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
  const seenOpen = new Set<string>();
  for (let i = attendanceRows.length - 1; i >= 0; i -= 1) {
    const row = attendanceRows[i];
    if (row?.checkOut !== null) {
      continue;
    }
    if (seenOpen.has(row.employeeId)) {
      row.checkOut = new Date(row.checkIn.getTime() + 8 * 60 * 60_000);
      row.workedMinutes = 480;
      row.status = 'PRESENT';
    } else {
      seenOpen.add(row.employeeId);
    }
  }

  await prisma.attendance.createMany({ data: attendanceRows });

  // ---- Time off ----------------------------------------------------------
  const typeIds = new Map<string, string>();
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

  for (const person of PEOPLE) {
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
      const month = 2 + Math.floor(random() * 7);
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
      const start = day(
        `2026-0${String(6 + Math.floor(random() * 3))}-${String(5 + Math.floor(random() * 20)).padStart(2, '0')}`,
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
  let payslipCount = 0;

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

    for (const person of PEOPLE) {
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
          lines: {
            create: result.lines.map((line) => ({
              ruleId: line.ruleId,
              code: line.code,
              name: line.name,
              category: line.category,
              sequence: line.sequence,
              quantity: line.quantity,
              rate: line.rate,
              amount: line.amount,
            })),
          },
        },
      });

      payslipCount += 1;
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
  const accounts: { email: string; roles: Role[]; code: string | null }[] = [
    { email: 'payroll@oxp.com', roles: ['HR_PAYROLL_MANAGER'], code: 'EMP001' },
    {
      email: 'payrolluser@oxp.com',
      roles: ['HR_PAYROLL_USER'],
      code: 'EMP002',
    },
    { email: 'hr@oxp.com', roles: ['HR_MANAGER'], code: 'EMP004' },
    { email: 'employee@oxp.com', roles: ['EMPLOYEE'], code: 'EMP007' },
  ];

  for (const account of accounts) {
    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        roles: account.roles,
        employeeId:
          account.code === null
            ? null
            : (employees.get(account.code)?.id ?? null),
      },
    });
  }

  const attendanceCount = await prisma.attendance.count();
  const requestCount = await prisma.timeOffRequest.count();

  console.log('PayZ demo data');
  console.log('==============');
  console.log(`  company           ${company.name}`);
  console.log(`  departments       ${String(DEPARTMENTS.length)}`);
  console.log(`  employees         ${String(PEOPLE.length)}`);
  console.log(`  contracts         ${String(reference - 1)}`);
  console.log(`  schedules         3`);
  console.log(
    `  salary rules      ${String(REGULAR_SALARY_RULES.length)} regular + ${String(INTERN_SALARY_RULES.length)} intern`,
  );
  console.log(
    `  attendance        ${String(attendanceCount)} records over 3 months`,
  );
  console.log(
    `  time off requests ${String(requestCount)} (${String(approvedLeaveDays)} approved days, ${String(pendingRequests)} pending)`,
  );
  console.log(
    `  payruns           ${String(PERIODS.length)} (5 finalised + September draft)`,
  );
  console.log(
    `  payslips          ${String(payslipCount)}, all computed by the rule engine`,
  );
  console.log(
    `  net salary paid   Rs ${(totalNetPaid / 100).toLocaleString('en-IN')}`,
  );
  console.log('');
  console.log(`Sign in with any of these. Password: ${DEMO_PASSWORD}`);
  console.log('  admin@oxp.com        ADMIN');
  for (const account of accounts) {
    console.log(`  ${account.email.padEnd(20)} ${account.roles.join(', ')}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
