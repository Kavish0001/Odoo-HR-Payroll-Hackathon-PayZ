import { z } from 'zod';

import {
  CONTRACT_STATUSES,
  EMPLOYEE_TYPES,
  WEEKDAYS,
  type ContractStatus,
  type EmployeeType,
  type Weekday,
} from '../enums.js';

import {
  daySchema,
  emailSchema,
  idSchema,
  minuteOfDaySchema,
  nonEmptyString,
  optionalString,
  paginationSchema,
  rupeesSchema,
} from './common.js';

// ---------------------------------------------------------------------------
// Department & job position
// ---------------------------------------------------------------------------

export const departmentSchema = z.object({
  name: nonEmptyString('Department name', 100),
  code: optionalString(20),
  managerId: idSchema.nullish(),
  active: z.boolean().default(true),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const jobPositionSchema = z.object({
  title: nonEmptyString('Job title', 100),
  active: z.boolean().default(true),
});
export type JobPositionInput = z.infer<typeof jobPositionSchema>;

export interface DepartmentRow {
  id: string;
  name: string;
  code: string | null;
  managerName: string | null;
  employeeCount: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Working schedule
// ---------------------------------------------------------------------------

export const scheduleLineSchema = z
  .object({
    dayOfWeek: z.enum(WEEKDAYS),
    startMinute: minuteOfDaySchema,
    endMinute: minuteOfDaySchema,
    breakMinutes: z.number().int().min(0).default(0),
  })
  .refine((line) => line.endMinute > line.startMinute, {
    message: 'End time must be after start time',
    path: ['endMinute'],
  })
  .refine(
    (line) => line.breakMinutes < line.endMinute - line.startMinute,
    // A break longer than the day would make weekly hours negative (rule S2).
    {
      message: 'Break cannot be longer than the working day',
      path: ['breakMinutes'],
    },
  );

export const workingScheduleSchema = z.object({
  name: nonEmptyString('Schedule name', 100),
  calendarType: z.string().trim().max(50).default('Standard'),
  timezone: z.string().trim().max(64).default('Asia/Kolkata'),
  active: z.boolean().default(true),
  lines: z
    .array(scheduleLineSchema)
    .min(1, 'Add at least one working day')
    .refine(
      (lines) =>
        new Set(lines.map((line) => line.dayOfWeek)).size === lines.length,
      'Each weekday may appear only once',
    ),
});
export type WorkingScheduleInput = z.infer<typeof workingScheduleSchema>;

export interface ScheduleLineRow {
  id: string;
  dayOfWeek: Weekday;
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
  /** Derived: (end - start - break) / 60. Never stored (rule S1). */
  hours: number;
}

export interface WorkingScheduleRow {
  id: string;
  name: string;
  calendarType: string;
  companyName: string;
  timezone: string;
  active: boolean;
  /** Derived from the lines, never entered by hand (rule S1). */
  daysPerWeek: number;
  hoursPerWeek: number;
  employeeCount: number;
  lines?: ScheduleLineRow[];
}

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------

export const employeeSchema = z.object({
  code: nonEmptyString('Employee code', 20),
  firstName: nonEmptyString('First name', 60),
  lastName: nonEmptyString('Last name', 60),
  workEmail: emailSchema,
  personalEmail: emailSchema.nullish(),
  phone: optionalString(30),

  departmentId: idSchema.nullish(),
  jobPositionId: idSchema.nullish(),
  managerId: idSchema.nullish(),
  workingScheduleId: idSchema.nullish(),

  employeeType: z.enum(EMPLOYEE_TYPES).default('FULL_TIME'),
  workLocation: optionalString(100),

  bankAccount: optionalString(40),
  bankName: optionalString(80),
  bankIfsc: optionalString(20),

  joinDate: daySchema.nullish(),
  active: z.boolean().default(true),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

/**
 * The only columns an employee may change on their own record.
 *
 * Contact details and bank details are the employee's own facts to correct --
 * and missing bank details are a payroll warning (rule W7), so the person who
 * can actually fix it should be able to. Everything else on the record
 * (code, names, department, manager, position, schedule, type, join date,
 * active) describes their employment rather than them, and stays with HR.
 *
 * Stated once, here: the API narrows the update payload to these keys, and
 * the form renders exactly these as editable. Neither side can drift.
 */
export const employeeSelfSchema = employeeSchema.pick({
  personalEmail: true,
  phone: true,
  bankAccount: true,
  bankName: true,
  bankIfsc: true,
});
export type EmployeeSelfInput = z.infer<typeof employeeSelfSchema>;

export const EMPLOYEE_SELF_FIELDS = Object.keys(
  employeeSelfSchema.shape,
) as (keyof EmployeeSelfInput)[];

export const employeeQuerySchema = paginationSchema.extend({
  departmentId: idSchema.optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  active: z.enum(['true', 'false']).optional(),
});
export type EmployeeQuery = z.infer<typeof employeeQuerySchema>;

export interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  workEmail: string;
  phone: string | null;
  departmentName: string | null;
  jobPositionTitle: string | null;
  managerName: string | null;
  scheduleName: string | null;
  employeeType: EmployeeType;
  workLocation: string | null;
  active: boolean;
  /** True when bank details are missing, which payroll will warn about. */
  missingBankDetails: boolean;
}

/** Employee form payload plus the smart-button counts from the wireframe. */
export interface EmployeeDetail extends EmployeeRow {
  personalEmail: string | null;
  bankAccount: string | null;
  bankName: string | null;
  bankIfsc: string | null;
  joinDate: string | null;
  departmentId: string | null;
  jobPositionId: string | null;
  managerId: string | null;
  workingScheduleId: string | null;
  counts: {
    contracts: number;
    attendance: number;
    timeOff: number;
    allocations: number;
  };
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const contractSchema = z
  .object({
    reference: nonEmptyString('Reference', 40),
    employeeId: idSchema,
    startDate: daySchema,
    /** Null means open-ended, which is why period resolution is a range test. */
    endDate: daySchema.nullish(),
    wageMonthly: rupeesSchema.refine(
      (rupees) => rupees > 0,
      'Wage must be greater than zero',
    ),
    departmentId: idSchema.nullish(),
    jobPositionId: idSchema.nullish(),
    workingScheduleId: idSchema.nullish(),
    salaryStructureId: idSchema.nullish(),
    status: z.enum(CONTRACT_STATUSES).default('DRAFT'),
    notes: optionalString(1000),
  })
  .refine(
    (contract) =>
      contract.endDate === null ||
      contract.endDate === undefined ||
      contract.endDate >= contract.startDate,
    { message: 'End date cannot be before the start date', path: ['endDate'] },
  );
export type ContractInput = z.infer<typeof contractSchema>;

export const contractQuerySchema = paginationSchema.extend({
  employeeId: idSchema.optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
});
export type ContractQuery = z.infer<typeof contractQuerySchema>;

export interface ContractRow {
  id: string;
  reference: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  jobPositionTitle: string | null;
  startDate: string;
  endDate: string | null;
  /** Integer paise. Format at the edge with formatINR. */
  wageMonthly: number;
  status: ContractStatus;
  scheduleName: string | null;
  structureName: string | null;
  notes?: string | null;
}
