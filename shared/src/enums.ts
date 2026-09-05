/**
 * Domain vocabulary shared by the API and the client.
 *
 * These mirror the Prisma enums exactly. They live here rather than being
 * imported from the generated Prisma client so the browser bundle never
 * pulls in server code, and so a renamed status breaks both lanes at
 * compile time instead of at runtime.
 */

export const ROLES = [
  'EMPLOYEE',
  'HR_MANAGER',
  'HR_PAYROLL_USER',
  'HR_PAYROLL_MANAGER',
  'ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Ascending capability. A guard can therefore ask "at least HR_MANAGER"
 * instead of enumerating every role above it (rule R1).
 */
export const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 0,
  HR_MANAGER: 1,
  HR_PAYROLL_USER: 2,
  HR_PAYROLL_MANAGER: 3,
  ADMIN: 4,
};

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  HR_MANAGER: 'HR Manager',
  HR_PAYROLL_USER: 'HR Payroll User',
  HR_PAYROLL_MANAGER: 'HR Payroll Manager',
  ADMIN: 'Admin',
};

export const EMPLOYEE_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPES)[number];

export const CONTRACT_STATUSES = [
  'DRAFT',
  'RUNNING',
  'EXPIRED',
  'CANCELLED',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'MISSING_CHECKOUT',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_SOURCES = ['WIDGET', 'MANUAL'] as const;
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number];

export const TIME_OFF_UNITS = ['DAYS', 'HOURS'] as const;
export type TimeOffUnit = (typeof TIME_OFF_UNITS)[number];

export const APPROVAL_LEVELS = ['NONE', 'MANAGER', 'OFFICER'] as const;
export type ApprovalLevel = (typeof APPROVAL_LEVELS)[number];

/** Shared by allocations and requests: both follow the same approval lifecycle. */
export const TIME_OFF_STATUSES = [
  'TO_APPROVE',
  'APPROVED',
  'REFUSED',
  'CANCELLED',
] as const;
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

/**
 * Salary rule categories, in the order they appear on a payslip.
 * GROSS and NET are totals built from the categories before them, which is
 * why sequence ordering matters (rules P1, P7).
 */
export const RULE_CATEGORIES = [
  'BASIC',
  'ALLOWANCE',
  'GROSS',
  'DEDUCTION',
  'NET',
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  BASIC: 'Basic',
  ALLOWANCE: 'Allowance',
  GROSS: 'Gross',
  DEDUCTION: 'Deduction',
  NET: 'Net',
};

export const COMPUTATION_TYPES = ['FIXED', 'PERCENTAGE', 'FORMULA'] as const;
export type ComputationType = (typeof COMPUTATION_TYPES)[number];

export const COMPUTATION_TYPE_LABELS: Record<ComputationType, string> = {
  FIXED: 'Fixed Amount',
  PERCENTAGE: 'Percentage of Base',
  FORMULA: 'Formula',
};

/** What a PERCENTAGE rule takes its percentage of (rule P4). */
export const PERCENTAGE_BASES = [
  'CONTRACT_WAGE',
  'BASIC',
  'GROSS',
  'RULE',
] as const;
export type PercentageBase = (typeof PERCENTAGE_BASES)[number];

export const PAYRUN_STATUSES = [
  'DRAFT',
  'COMPUTED',
  'VALIDATED',
  'PAID',
  'CANCELLED',
] as const;
export type PayrunStatus = (typeof PAYRUN_STATUSES)[number];

export const PAYSLIP_STATUSES = ['DRAFT', 'DONE', 'PAID', 'CANCELLED'] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

/**
 * Payroll issues surfaced before finalisation (rule W7).
 * Blocking codes prevent Validate; advisory codes require acknowledgement.
 */
export const WARNING_CODES = [
  'NO_CONTRACT',
  'DUPLICATE_PAYSLIP',
  'RULE_ERROR',
  'MISSING_BANK_ACCOUNT',
  'INCOMPLETE_EMPLOYEE',
  'CONTRACT_EXPIRING',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export const BLOCKING_WARNINGS: readonly WarningCode[] = [
  'NO_CONTRACT',
  'DUPLICATE_PAYSLIP',
  'RULE_ERROR',
];

export const WARNING_LABELS: Record<WarningCode, string> = {
  NO_CONTRACT: 'No applicable contract',
  DUPLICATE_PAYSLIP: 'Duplicate payslip',
  RULE_ERROR: 'Salary rule failed',
  MISSING_BANK_ACCOUNT: 'A/C missing',
  INCOMPLETE_EMPLOYEE: 'Incomplete employee record',
  CONTRACT_EXPIRING: 'Contract expiring',
};

export function isBlockingWarning(code: WarningCode): boolean {
  return BLOCKING_WARNINGS.includes(code);
}

export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};
