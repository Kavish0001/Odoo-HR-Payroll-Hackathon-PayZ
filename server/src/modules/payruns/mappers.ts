import {
  WARNING_LABELS,
  type PayrollWarningRow,
  type PayrunRow,
  type PayslipDetail,
  type PayslipLineRow,
  type PayslipRow,
} from '@payz/shared';
import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Prisma row -> shared API shape conversions for the payruns module, kept in
 * one place so the list, detail and workflow-response payloads never drift
 * from one another.
 */

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Payrun
// ---------------------------------------------------------------------------

export const payrunListArgs = Prisma.validator<Prisma.PayrunDefaultArgs>()({
  include: {
    salaryStructure: { select: { name: true } },
    payslips: { select: { netAmount: true } },
    warnings: { select: { blocking: true } },
  },
});
export type PayrunListPayload = Prisma.PayrunGetPayload<typeof payrunListArgs>;

export function toPayrunRow(payrun: PayrunListPayload): PayrunRow {
  const totalNet = payrun.payslips.reduce((sum, p) => sum + p.netAmount, 0);

  return {
    id: payrun.id,
    name: payrun.name,
    structureName: payrun.salaryStructure.name,
    periodStart: toDateOnly(payrun.periodStart),
    periodEnd: toDateOnly(payrun.periodEnd),
    status: payrun.status,
    employeeCount: payrun.payslips.length,
    payslipCount: payrun.payslips.length,
    warningCount: payrun.warnings.length,
    blockingWarningCount: payrun.warnings.filter((w) => w.blocking).length,
    totalNet,
    version: payrun.version,
    computedAt: payrun.computedAt?.toISOString() ?? null,
    validatedAt: payrun.validatedAt?.toISOString() ?? null,
    paidAt: payrun.paidAt?.toISOString() ?? null,
    payslipsSentAt: payrun.payslipsSentAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Payslip
// ---------------------------------------------------------------------------

export const payslipWithRelationsArgs = Prisma.validator<Prisma.PayslipDefaultArgs>()({
  include: {
    employee: { select: { firstName: true, lastName: true, code: true, workEmail: true, department: { select: { name: true } } } },
    structure: { select: { name: true } },
    payrun: { select: { name: true } },
    contract: { select: { reference: true } },
    warnings: { select: { code: true } },
  },
});
export type PayslipWithRelations = Prisma.PayslipGetPayload<typeof payslipWithRelationsArgs>;

export function toPayslipRow(payslip: PayslipWithRelations): PayslipRow {
  return {
    id: payslip.id,
    number: payslip.number,
    payrunId: payslip.payrunId,
    payrunName: payslip.payrun.name,
    employeeId: payslip.employeeId,
    employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
    departmentName: payslip.employee.department?.name ?? null,
    structureName: payslip.structure.name,
    periodStart: toDateOnly(payslip.periodStart),
    periodEnd: toDateOnly(payslip.periodEnd),
    workedDays: payslip.workedDays,
    leaveDays: payslip.leaveDays,
    basicAmount: payslip.basicAmount,
    allowanceAmount: payslip.allowanceAmount,
    grossAmount: payslip.grossAmount,
    deductionAmount: payslip.deductionAmount,
    netAmount: payslip.netAmount,
    status: payslip.status,
    warnings: payslip.warnings.map((w) => WARNING_LABELS[w.code]),
  };
}

export const payslipDetailArgs = Prisma.validator<Prisma.PayslipDefaultArgs>()({
  include: {
    ...payslipWithRelationsArgs.include,
    lines: { orderBy: { sequence: 'asc' } },
  },
});
export type PayslipDetailPayload = Prisma.PayslipGetPayload<typeof payslipDetailArgs>;

export function toPayslipLineRow(
  line: PayslipDetailPayload['lines'][number],
): PayslipLineRow {
  return {
    id: line.id,
    code: line.code,
    name: line.name,
    category: line.category,
    sequence: line.sequence,
    quantity: line.quantity,
    rate: line.rate,
    amount: line.amount,
  };
}

export function toPayslipDetail(payslip: PayslipDetailPayload): PayslipDetail {
  return {
    ...toPayslipRow(payslip),
    contractReference: payslip.contract.reference,
    contractWage: payslip.contractWage,
    lines: payslip.lines.map(toPayslipLineRow),
    emailSentAt: payslip.emailSentAt?.toISOString() ?? null,
    version: payslip.version,
  };
}

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

const warningWithEmployeeArgs = Prisma.validator<Prisma.PayrollWarningDefaultArgs>()({
  include: {
    payslip: { select: { employee: { select: { firstName: true, lastName: true } } } },
  },
});
export type WarningWithEmployee = Prisma.PayrollWarningGetPayload<
  typeof warningWithEmployeeArgs
>;

export function toWarningRow(warning: WarningWithEmployee): PayrollWarningRow {
  return {
    id: warning.id,
    code: warning.code,
    message: warning.message,
    blocking: warning.blocking,
    payslipId: warning.payslipId,
    employeeName:
      warning.payslip === null
        ? null
        : `${warning.payslip.employee.firstName} ${warning.payslip.employee.lastName}`,
    acknowledgedAt: warning.acknowledgedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Payrun detail: the row plus its payslips and warnings, for the processing
// screen and every workflow-action response.
// ---------------------------------------------------------------------------

export interface PayrunDetail extends PayrunRow {
  salaryStructureId: string;
  payslips: PayslipRow[];
  warnings: PayrollWarningRow[];
}

type PayrunDb = Pick<PrismaClient, 'payrun' | 'payslip' | 'payrollWarning'>;

export async function getPayrunDetail(
  db: PayrunDb,
  id: string,
): Promise<PayrunDetail | null> {
  const payrun = await db.payrun.findUnique({ where: { id }, ...payrunListArgs });
  if (payrun === null) {
    return null;
  }

  const [payslips, warnings] = await Promise.all([
    db.payslip.findMany({
      where: { payrunId: id },
      ...payslipWithRelationsArgs,
      orderBy: { employee: { firstName: 'asc' } },
    }),
    db.payrollWarning.findMany({
      where: { payrunId: id },
      ...warningWithEmployeeArgs,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    ...toPayrunRow(payrun),
    salaryStructureId: payrun.salaryStructureId,
    payslips: payslips.map(toPayslipRow),
    warnings: warnings.map(toWarningRow),
  };
}
