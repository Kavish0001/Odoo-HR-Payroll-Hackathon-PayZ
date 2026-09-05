import { fileURLToPath } from 'node:url';

import { PrismaClient, type Prisma, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

// The seed runs outside the server, so it loads the root .env itself.
loadDotenv({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

/**
 * Demo data.
 *
 * Refuses to run against anything but a local database, so a stray
 * DATABASE_URL cannot truncate something real (guardrail 10.9).
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'payz-demo-2026';

function assertLocalDatabase(): void {
  const url = process.env['DATABASE_URL'] ?? '';
  const host = url.length > 0 ? new URL(url).hostname : '';

  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Refusing to seed a non-local database (host: ${host || 'unset'}).`,
    );
  }
}

/** Minutes from midnight, so schedule maths needs no date context. */
const at = (hour: number, minute = 0): number => hour * 60 + minute;

async function main(): Promise<void> {
  assertLocalDatabase();

  // Order matters: children before parents.
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

  const company = await prisma.company.create({
    data: { name: 'OXP Pvt Ltd', legalName: 'OXP Private Limited' },
  });

  const departments = await Promise.all(
    ['Finance', 'HR', 'Engineering', 'Sales', 'Support', 'IT'].map((name) =>
      prisma.department.create({ data: { name, companyId: company.id } }),
    ),
  );
  const byDept = new Map(departments.map((d) => [d.name, d.id]));

  const positions = await Promise.all(
    [
      'Payroll Specialist',
      'HR Officer',
      'Developer',
      'Recruiter',
      'Sales Executive',
      'Support Engineer',
    ].map((title) => prisma.jobPosition.create({ data: { title } })),
  );
  const byPosition = new Map(positions.map((p) => [p.title, p.id]));

  // A standard week: five days, 9 to 6 with an hour of break, so weekly hours
  // derive to 40 rather than being typed in (rule S1).
  const weekdays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ] as const;

  const schedule = await prisma.workingSchedule.create({
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

  await prisma.workingSchedule.create({
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

  const people: {
    code: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    position: string;
    wage: number;
    bank: boolean;
  }[] = [
    {
      code: 'EMP001',
      firstName: 'Aarav',
      lastName: 'Mehta',
      email: 'aarav@oxp.com',
      department: 'Finance',
      position: 'Payroll Specialist',
      wage: 8_500_000,
      bank: true,
    },
    {
      code: 'EMP002',
      firstName: 'Sara',
      lastName: 'Khan',
      email: 'sara@oxp.com',
      department: 'HR',
      position: 'HR Officer',
      wage: 9_500_000,
      // Deliberately missing, so the MISSING_BANK_ACCOUNT warning has
      // something real to find during the demo.
      bank: false,
    },
    {
      code: 'EMP003',
      firstName: 'John',
      lastName: 'Dsouza',
      email: 'john@oxp.com',
      department: 'Engineering',
      position: 'Developer',
      wage: 7_200_000,
      bank: true,
    },
    {
      code: 'EMP004',
      firstName: 'Neha',
      lastName: 'Patel',
      email: 'neha@oxp.com',
      department: 'HR',
      position: 'Recruiter',
      wage: 6_400_000,
      bank: true,
    },
  ];

  const employees = [];
  for (const person of people) {
    const employee = await prisma.employee.create({
      data: {
        code: person.code,
        firstName: person.firstName,
        lastName: person.lastName,
        workEmail: person.email,
        companyId: company.id,
        departmentId: byDept.get(person.department) ?? null,
        jobPositionId: byPosition.get(person.position) ?? null,
        workingScheduleId: schedule.id,
        employeeType: 'FULL_TIME',
        workLocation: 'Mumbai',
        joinDate: new Date('2025-01-01'),
        ...(person.bank
          ? { bankAccount: `XXXX${person.code.slice(-4)}`, bankName: 'HDFC' }
          : {}),
      },
    });
    employees.push({ employee, wage: person.wage });
  }

  // Sara manages the others, matching the wireframe.
  const sara = employees[1]?.employee;
  if (sara !== undefined) {
    await prisma.employee.updateMany({
      where: { id: { not: sara.id } },
      data: { managerId: sara.id },
    });
  }

  // Contract history: one expired, one running. The exclusion constraint
  // guarantees the running ones cannot overlap (rule C1).
  let sequence = 18;
  for (const { employee, wage } of employees) {
    await prisma.contract.create({
      data: {
        reference: `CON/2025/${String(sequence++).padStart(4, '0')}`,
        employeeId: employee.id,
        startDate: new Date('2025-07-01'),
        endDate: new Date('2025-12-31'),
        wageMonthly: Math.round(wage * 0.92),
        status: 'EXPIRED',
        workingScheduleId: schedule.id,
      },
    });

    await prisma.contract.create({
      data: {
        reference: `CON/2026/${String(sequence++).padStart(4, '0')}`,
        employeeId: employee.id,
        startDate: new Date('2026-01-01'),
        endDate: null,
        wageMonthly: wage,
        status: 'RUNNING',
        workingScheduleId: schedule.id,
      },
    });
  }

  const timeOffTypes: Prisma.TimeOffTypeCreateInput[] = [
    {
      name: 'Paid Time Off',
      code: 'PTO',
      unit: 'DAYS',
      requiresAllocation: true,
      approvalLevel: 'MANAGER',
      payrollWorkEntry: 'Leave Work Entry',
      color: 'blue',
    },
    {
      name: 'Sick Leave',
      code: 'SICK',
      unit: 'DAYS',
      // No allocation required, so remaining balance reads N/A (rule T4).
      requiresAllocation: false,
      approvalLevel: 'MANAGER',
      color: 'amber',
    },
    {
      name: 'Comp Off',
      code: 'COMP',
      unit: 'HOURS',
      requiresAllocation: true,
      approvalLevel: 'OFFICER',
      color: 'green',
    },
  ];
  for (const type of timeOffTypes) {
    await prisma.timeOffType.create({ data: type });
  }

  // Accounts, one per role, so every permission path is demoable.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const accounts: {
    email: string;
    roles: Role[];
    employeeIndex: number | null;
  }[] = [
    { email: 'admin@oxp.com', roles: ['ADMIN'], employeeIndex: null },
    {
      email: 'payroll@oxp.com',
      roles: ['HR_PAYROLL_MANAGER'],
      employeeIndex: 0,
    },
    { email: 'hr@oxp.com', roles: ['HR_MANAGER'], employeeIndex: 1 },
    { email: 'employee@oxp.com', roles: ['EMPLOYEE'], employeeIndex: 2 },
  ];

  for (const account of accounts) {
    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        roles: account.roles,
        employeeId:
          account.employeeIndex === null
            ? null
            : (employees[account.employeeIndex]?.employee.id ?? null),
      },
    });
  }

  console.log('Seeded:');
  console.log(`  company     ${company.name}`);
  console.log(`  departments ${String(departments.length)}`);
  console.log(`  employees   ${String(employees.length)}`);
  console.log(
    `  contracts   ${String(employees.length * 2)} (1 expired + 1 running each)`,
  );
  console.log(`  time off    ${String(timeOffTypes.length)} types`);
  console.log('');
  console.log('Sign in with any of these, password: ' + DEMO_PASSWORD);
  for (const account of accounts) {
    console.log(`  ${account.email.padEnd(20)} ${String(account.roles)}`);
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
