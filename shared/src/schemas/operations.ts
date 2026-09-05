import { z } from 'zod';

import {
  APPROVAL_LEVELS,
  ATTENDANCE_STATUSES,
  TIME_OFF_STATUSES,
  TIME_OFF_UNITS,
  type ApprovalLevel,
  type AttendanceSource,
  type AttendanceStatus,
  type TimeOffStatus,
  type TimeOffUnit,
} from '../enums.js';

import {
  dateSchema,
  daySchema,
  idSchema,
  nonEmptyString,
  optionalString,
  paginationSchema,
} from './common.js';

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const attendanceSchema = z
  .object({
    employeeId: idSchema,
    checkIn: dateSchema,
    checkOut: dateSchema.nullish(),
    notes: optionalString(500),
  })
  .refine(
    (row) =>
      row.checkOut === null ||
      row.checkOut === undefined ||
      row.checkOut >= row.checkIn,
    { message: 'Check-out cannot be before check-in', path: ['checkOut'] },
  );
export type AttendanceInput = z.infer<typeof attendanceSchema>;

export const attendanceQuerySchema = paginationSchema.extend({
  employeeId: idSchema.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
});
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  checkIn: string;
  checkOut: string | null;
  /** Derived from the times and the schedule; never accepted from a client. */
  workedHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  /** True when a person corrected this record by hand (guardrail 10.9). */
  manuallyEdited: boolean;
  notes: string | null;
}

/** State of the check-in widget for the signed-in user. */
export interface AttendanceSession {
  open: boolean;
  attendanceId: string | null;
  checkInAt: string | null;
  /** Minutes since check-in, for the popup's elapsed counter. */
  elapsedMinutes: number;
}

// ---------------------------------------------------------------------------
// Time off types
// ---------------------------------------------------------------------------

export const timeOffTypeSchema = z.object({
  name: nonEmptyString('Type name', 80),
  code: nonEmptyString('Code', 20).transform((value) => value.toUpperCase()),
  unit: z.enum(TIME_OFF_UNITS).default('DAYS'),
  /** Drives whether approving a request needs an allocation (rule T3). */
  requiresAllocation: z.boolean().default(true),
  approvalLevel: z.enum(APPROVAL_LEVELS).default('MANAGER'),
  payrollWorkEntry: optionalString(80),
  isPaid: z.boolean().default(true),
  color: z.string().trim().max(20).default('info'),
  active: z.boolean().default(true),
});
export type TimeOffTypeInput = z.infer<typeof timeOffTypeSchema>;

export interface TimeOffTypeRow {
  id: string;
  name: string;
  code: string;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  approvalLevel: ApprovalLevel;
  payrollWorkEntry: string | null;
  isPaid: boolean;
  color: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

export const allocationSchema = z
  .object({
    employeeId: idSchema,
    typeId: idSchema,
    name: nonEmptyString('Allocation name', 100),
    allocatedQty: z.number().positive('Allocate more than zero'),
    validFrom: daySchema,
    validTo: daySchema.nullish(),
    description: optionalString(500),
  })
  .refine(
    (row) =>
      row.validTo === null ||
      row.validTo === undefined ||
      row.validTo >= row.validFrom,
    { message: 'Validity end cannot precede its start', path: ['validTo'] },
  );
export type AllocationInput = z.infer<typeof allocationSchema>;

export const allocationQuerySchema = paginationSchema.extend({
  employeeId: idSchema.optional(),
  typeId: idSchema.optional(),
  status: z.enum(TIME_OFF_STATUSES).optional(),
});
export type AllocationQuery = z.infer<typeof allocationQuerySchema>;

export interface AllocationRow {
  id: string;
  employeeId: string;
  employeeName: string;
  typeId: string;
  typeName: string;
  unit: TimeOffUnit;
  name: string;
  /** The three figures the wireframe wants visible at a glance. */
  allocatedQty: number;
  takenQty: number;
  remainingQty: number;
  validFrom: string;
  validTo: string | null;
  status: TimeOffStatus;
  approverName: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const timeOffRequestSchema = z
  .object({
    employeeId: idSchema,
    typeId: idSchema,
    startDate: daySchema,
    endDate: daySchema,
    reason: optionalString(500),
  })
  .refine((row) => row.endDate >= row.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  });
export type TimeOffRequestInput = z.infer<typeof timeOffRequestSchema>;

export const timeOffRequestQuerySchema = paginationSchema.extend({
  employeeId: idSchema.optional(),
  typeId: idSchema.optional(),
  status: z.enum(TIME_OFF_STATUSES).optional(),
});
export type TimeOffRequestQuery = z.infer<typeof timeOffRequestQuerySchema>;

export interface TimeOffRequestRow {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  typeId: string;
  typeName: string;
  unit: TimeOffUnit;
  startDate: string;
  endDate: string;
  /** Working days counted against the schedule, not calendar days (rule T6). */
  duration: number;
  status: TimeOffStatus;
  approverName: string | null;
  reason: string | null;
  /** Which balance this consumed, shown as "Allocation Used" (rule T3). */
  allocationId: string | null;
  allocationName: string | null;
}

/** Balance summary per employee and type, for the employee's own view. */
export interface LeaveBalanceRow {
  typeId: string;
  typeName: string;
  unit: TimeOffUnit;
  requiresAllocation: boolean;
  allocated: number;
  taken: number;
  remaining: number;
  pending: number;
}
