import { prisma } from '../../config/prisma.js';
import { notFound } from '../../middleware/errors.js';
import { type PayslipPdfData } from '../../pdf/payslip-document.js';

/**
 * Assembles the data `PayslipDocument` needs from the database. Shared by
 * the PDF download endpoint and the Send Payslips email attachment, so the
 * printed payslip and the emailed one are always built from the same query.
 */

/**
 * Shows only enough of an account number to recognise it.
 *
 * The payslip is emailed and forwarded on; printing the full account number
 * puts it in every mailbox it passes through, and the employee only needs to
 * confirm which of their accounts was paid.
 */
function maskAccount(account: string | null): string | null {
  if (account === null) {
    return null;
  }
  const digits = account.replace(/\s+/g, '');
  if (digits.length <= 4) {
    return digits;
  }
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export async function loadPayslipPdfData(
  payslipId: number,
): Promise<PayslipPdfData> {
  const payslip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          code: true,
          joinDate: true,
          bankName: true,
          bankAccount: true,
          bankIfsc: true,
          department: { select: { name: true } },
          jobPosition: { select: { title: true } },
          company: { select: { name: true, legalName: true } },
        },
      },
      structure: { select: { name: true } },
      contract: { select: { reference: true } },
      payrun: { select: { name: true } },
      lines: { orderBy: { sequence: 'asc' } },
    },
  });
  if (payslip === null) {
    throw notFound('Payslip not found');
  }

  const { employee } = payslip;

  return {
    // The employee's own company, not "whichever company row came first":
    // a payslip must be headed by the entity that employs the person.
    companyName: employee.company.name,
    companyLegalName: employee.company.legalName,
    number: payslip.number,
    payrunName: payslip.payrun.name,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeCode: employee.code,
    departmentName: employee.department?.name ?? null,
    designation: employee.jobPosition?.title ?? null,
    joinDate: employee.joinDate?.toISOString().slice(0, 10) ?? null,
    bankName: employee.bankName,
    bankAccountMasked: maskAccount(employee.bankAccount),
    bankIfsc: employee.bankIfsc,
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
