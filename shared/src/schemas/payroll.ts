import { z } from 'zod';

import {
  COMPUTATION_TYPES,
  EMPLOYEE_TYPES,
  PAYRUN_STATUSES,
  PAYSLIP_STATUSES,
  PERCENTAGE_BASES,
  RULE_CATEGORIES,
  WARNING_CODES,
  type ComputationType,
  type EmployeeType,
  type PayrunStatus,
  type PayslipStatus,
  type PercentageBase,
  type RuleCategory,
  type WarningCode,
} from '../enums.js';

import {
  daySchema,
  idSchema,
  nonEmptyString,
  optionalString,
  paginationSchema,
  percentageSchema,
  rupeesSchema,
} from './common.js';

// ---------------------------------------------------------------------------
// Salary structures and rules
// ---------------------------------------------------------------------------

export const salaryStructureSchema = z.object({
  name: nonEmptyString('Structure name', 100),
  code: nonEmptyString('Code', 20).transform((value) => value.toUpperCase()),
  active: z.boolean().default(true),
});
export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;

export interface SalaryStructureRow {
  id: string;
  name: string;
  code: string;
  active: boolean;
  ruleCount: number;
  employeeCount: number;
}

/**
 * A rule carries the fields for all three computation methods, and which ones
 * are required depends on the method chosen. Validating that here means the
 * form and the API refuse the same incomplete rule.
 */
export const salaryRuleSchema = z
  .object({
    structureId: idSchema,
    name: nonEmptyString('Rule name', 100),
    code: nonEmptyString('Code', 20).transform((value) => value.toUpperCase()),
    category: z.enum(RULE_CATEGORIES),
    sequence: z.number().int().min(1).max(9999),
    computationType: z.enum(COMPUTATION_TYPES),
    fixedAmount: rupeesSchema.nullish(),
    percentage: percentageSchema.nullish(),
    percentageBase: z.enum(PERCENTAGE_BASES).nullish(),
    percentageRuleCode: optionalString(20),
    formula: optionalString(1000),
    quantity: z.number().positive().default(1),
    active: z.boolean().default(true),
  })
  .superRefine((rule, ctx) => {
    // GROSS and NET are totals of what came before, so they need no
    // configuration at all (rule P7).
    if (rule.category === 'GROSS' || rule.category === 'NET') {
      return;
    }

    if (rule.computationType === 'FIXED' && rule.fixedAmount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter the fixed amount',
        path: ['fixedAmount'],
      });
    }

    if (rule.computationType === 'PERCENTAGE') {
      if (rule.percentage == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter the percentage',
          path: ['percentage'],
        });
      }
      if (rule.percentageBase == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Choose what the percentage applies to',
          path: ['percentageBase'],
        });
      }
      if (
        rule.percentageBase === 'RULE' &&
        (rule.percentageRuleCode ?? '').length === 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Name the rule to take a percentage of',
          path: ['percentageRuleCode'],
        });
      }
    }

    if (
      rule.computationType === 'FORMULA' &&
      (rule.formula ?? '').trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Write the formula',
        path: ['formula'],
      });
    }
  });
export type SalaryRuleInput = z.infer<typeof salaryRuleSchema>;

export interface SalaryRuleRow {
  id: string;
  structureId: string;
  structureName: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  computationType: ComputationType;
  /** Integer paise. */
  fixedAmount: number | null;
  percentage: number | null;
  percentageBase: PercentageBase | null;
  percentageRuleCode: string | null;
  formula: string | null;
  quantity: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Payrun wizard
// ---------------------------------------------------------------------------

/**
 * Step one of the wizard. This is deliberately a read-only preview: there is
 * no write path behind it, which is what guarantees Continue cannot create a
 * payrun (rule W1).
 */
export const payrunScopeSchema = z
  .object({
    salaryStructureId: idSchema,
    periodStart: daySchema,
    periodEnd: daySchema,
    employeeTypeScope: z.enum(EMPLOYEE_TYPES).nullish(),
  })
  .refine((scope) => scope.periodEnd >= scope.periodStart, {
    message: 'Period end cannot be before its start',
    path: ['periodEnd'],
  });
export type PayrunScopeInput = z.infer<typeof payrunScopeSchema>;

/** One eligible employee in step two of the wizard. */
export interface EligibleEmployee {
  employeeId: string;
  code: string;
  fullName: string;
  departmentName: string | null;
  employeeType: EmployeeType;
  scheduleName: string | null;
  contractStartDate: string;
  /** Integer paise, from the contract applicable to the period (rule C2). */
  wageMonthly: number;
  contractReference: string;
  /** Present when this employee already has a payslip for the period. */
  duplicateWarning: string | null;
}

/** Step two. Only the employees listed here end up in the payrun (rule W2). */
export const createPayrunSchema = payrunScopeSchema.and(
  z.object({
    name: nonEmptyString('Payrun name', 100),
    employeeIds: z.array(idSchema).min(1, 'Select at least one employee'),
  }),
);
export type CreatePayrunInput = z.infer<typeof createPayrunSchema>;

export const payrunQuerySchema = paginationSchema.extend({
  status: z.enum(PAYRUN_STATUSES).optional(),
  year: z.coerce.number().int().optional(),
});
export type PayrunQuery = z.infer<typeof payrunQuerySchema>;

export interface PayrunRow {
  id: string;
  name: string;
  structureName: string;
  periodStart: string;
  periodEnd: string;
  status: PayrunStatus;
  employeeCount: number;
  payslipCount: number;
  warningCount: number;
  blockingWarningCount: number;
  /** Integer paise. */
  totalNet: number;
  version: number;
  computedAt: string | null;
  validatedAt: string | null;
  paidAt: string | null;
  payslipsSentAt: string | null;
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

export const payslipQuerySchema = paginationSchema.extend({
  payrunId: idSchema.optional(),
  employeeId: idSchema.optional(),
  status: z.enum(PAYSLIP_STATUSES).optional(),
});
export type PayslipQuery = z.infer<typeof payslipQuerySchema>;

export interface PayslipLineRow {
  id: string;
  code: string;
  name: string;
  category: RuleCategory;
  sequence: number;
  quantity: number;
  rate: number;
  /** Integer paise. Negative for deductions. */
  amount: number;
}

export interface PayslipRow {
  id: string;
  number: string;
  payrunId: string;
  payrunName: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  structureName: string;
  periodStart: string;
  periodEnd: string;
  workedDays: number;
  leaveDays: number;
  basicAmount: number;
  allowanceAmount: number;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: PayslipStatus;
  /** Short labels for the Warning column, e.g. "A/C missing". */
  warnings: string[];
}

export interface PayslipDetail extends PayslipRow {
  contractReference: string;
  contractWage: number;
  lines: PayslipLineRow[];
  emailSentAt: string | null;
  version: number;
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

export interface PayrollWarningRow {
  id: string;
  code: WarningCode;
  message: string;
  blocking: boolean;
  payslipId: string | null;
  employeeName: string | null;
  acknowledgedAt: string | null;
}

export const warningCodeSchema = z.enum(WARNING_CODES);

/** Optimistic locking: workflow actions send the version they read. */
export const workflowActionSchema = z.object({
  version: z.number().int().nonnegative(),
});
export type WorkflowAction = z.infer<typeof workflowActionSchema>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardQuerySchema = z.object({
  periodStart: daySchema.optional(),
  periodEnd: daySchema.optional(),
  departmentId: idSchema.optional(),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface DashboardKpis {
  /** Integer paise. */
  totalNetPaid: number;
  totalNetPreviousPeriod: number;
  payslipsGenerated: number;
  payslipsPaid: number;
  payslipsPending: number;
  averageSalary: number;
  approvedTimeOffDays: number;
  /** Present and reviewed records as a percentage of all records. */
  attendanceHealth: number;
  headcount: number;
}

export interface DepartmentSalaryPoint {
  departmentId: string;
  departmentName: string;
  headcount: number;
  totalNet: number;
}

export interface SalaryTrendPoint {
  period: string;
  periodStart: string;
  totalNet: number;
  payslipCount: number;
}

export interface AttendanceOverview {
  present: number;
  late: number;
  absent: number;
  overtimeHours: number;
  missingCheckouts: number;
  manualEdits: number;
  /** Records present as a share of expected working days. */
  coverage: number;
}

export interface TimeOffOverviewRow {
  typeId: string;
  typeName: string;
  approvedDays: number;
  pending: number;
  /** Null for types that require no allocation, shown as N/A (rule T4). */
  remainingBalance: number | null;
}

export interface PayrollAlert {
  code: WarningCode | 'DRAFT_NOT_VALIDATED';
  message: string;
  count: number;
  severity: 'blocking' | 'advisory';
}

export interface DashboardData {
  kpis: DashboardKpis;
  salaryByDepartment: DepartmentSalaryPoint[];
  salaryTrend: SalaryTrendPoint[];
  payslipStatusSplit: { status: PayslipStatus; count: number }[];
  alerts: PayrollAlert[];
  attendance: AttendanceOverview;
  timeOff: TimeOffOverviewRow[];
  departments: DepartmentSalaryPoint[];
}
