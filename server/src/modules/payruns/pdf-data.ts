import { prisma } from '../../config/prisma.js';
import { notFound } from '../../middleware/errors.js';
import { type PayslipPdfData } from '../../pdf/payslip-document.js';

/**
 * Assembles the data `PayslipDocument` needs from the database. Shared by
 * the PDF download endpoint and the Send Payslips email attachment, so the
 * printed payslip and the emailed one are always built from the same query.
 */
export async function loadPayslipPdfData(
  payslipId: string,
): Promise<PayslipPdfData> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          code: true,
          department: { select: { name: true } },
        },
      },
      structure: { select: { name: true } },
      contract: { select: { reference: true } },
      lines: { orderBy: { sequence: 'asc' } },
    },
  });
  if (payslip === null) {
    throw notFound('Payslip not found');
  }

  const company = await prisma.company.findFirst({ select: { name: true } });

  return {
    companyName: company?.name ?? 'PayZ',
    number: payslip.number,
    employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
    employeeCode: payslip.employee.code,
    departmentName: payslip.employee.department?.name ?? null,
    structureName: payslip.structure.name,
    periodStart: payslip.periodStart.toISOString().slice(0, 10),
    periodEnd: payslip.periodEnd.toISOString().slice(0, 10),
    workedDays: payslip.workedDays,
    leaveDays: payslip.leaveDays,
    contractReference: payslip.contract.reference,
    contractWage: payslip.contractWage,
    basicAmount: payslip.basicAmount,
    allowanceAmount: payslip.allowanceAmount,
    grossAmount: payslip.grossAmount,
    deductionAmount: payslip.deductionAmount,
    netAmount: payslip.netAmount,
    lines: payslip.lines.map((line) => ({
      code: line.code,
      name: line.name,
      category: line.category,
      sequence: line.sequence,
      amount: line.amount,
    })),
  };
}
