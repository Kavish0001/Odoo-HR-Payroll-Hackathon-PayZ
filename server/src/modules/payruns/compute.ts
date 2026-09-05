import { type Contract, type Prisma } from '@prisma/client';

import { selectPeriodContract } from '../contracts/resolve-period-contract.js';
import {
  computePayslip,
  PayrollComputationError,
  type ComputeResult,
} from '../payroll/engine.js';
import { toRuleDefinition } from '../salary-config/helpers.js';

import { computeWorkedFacts } from './attendance-facts.js';
import { findDuplicatePayslip } from './eligibility.js';
import {
  buildPayslipWarnings,
  isContractExpiringSoon,
  isEmployeeIncomplete,
  replacePayslipWarnings,
} from './warnings.js';

/**
 * The Compute action (rules P9, W7).
 *
 * Every payslip already belonging to the payrun is recomputed from scratch:
 * the contract is re-resolved (it may have changed since the payrun was
 * created), attendance is re-read, the engine runs again, and both the
 * payslip's lines and its warnings are deleted and rewritten rather than
 * appended to. Nothing here mutates the payrun's own row or status — the
 * caller (`payruns.routes.ts`) does that once every payslip has been
 * processed, inside the same transaction.
 */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function seniorityYears(periodStart: Date, joinDate: Date | null): number {
  if (joinDate === null) {
    return 0;
  }
  const elapsed = periodStart.getTime() - joinDate.getTime();
  return elapsed <= 0 ? 0 : Math.floor(elapsed / MS_PER_YEAR);
}

interface PayrunForCompute {
  id: number;
  salaryStructureId: number;
  periodStart: Date;
  periodEnd: Date;
}

export async function computePayrunPayslips(
  tx: Prisma.TransactionClient,
  payrun: PayrunForCompute,
): Promise<void> {
  const ruleRows = await tx.salaryRule.findMany({
    where: { structureId: payrun.salaryStructureId, active: true },
    orderBy: { sequence: 'asc' },
  });
  const rules = ruleRows.map(toRuleDefinition);

  const payslips = await tx.payslip.findMany({
    where: { payrunId: payrun.id },
    include: { employee: true },
  });

  /**
   * Every contract this payrun could possibly need, in one query.
   *
   * Resolving the period contract per employee meant a round trip per
   * payslip, inside the transaction -- for a 122-employee run that was 122
   * sequential queries and the bulk of the compute time. The overlap rule
   * itself is unchanged; only the fetching moved.
   */
  const contractsByEmployee = new Map<number, Contract[]>();
  for (const contract of await tx.contract.findMany({
    where: { employeeId: { in: payslips.map((p) => p.employeeId) } },
  })) {
    const forEmployee = contractsByEmployee.get(contract.employeeId) ?? [];
    forEmployee.push(contract);
    contractsByEmployee.set(contract.employeeId, forEmployee);
  }

  for (const payslip of payslips) {
    const { employee } = payslip;
    const fullName = `${employee.firstName} ${employee.lastName}`;

    const contract = selectPeriodContract(
      contractsByEmployee.get(employee.id) ?? [],
      payrun.periodStart,
      payrun.periodEnd,
    );

    if (contract?.salaryStructureId !== payrun.salaryStructureId) {
      await replacePayslipWarnings(
        tx,
        payrun.id,
        payslip.id,
        buildPayslipWarnings({
          fullName,
          hasContract: false,
          ruleError: null,
          duplicatePayrunName: null,
          missingBankAccount: false,
          incompleteEmployee: false,
          contractExpiring: false,
        }),
      );
      await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          basicAmount: 0,
          allowanceAmount: 0,
          grossAmount: 0,
          deductionAmount: 0,
          netAmount: 0,
          workedDays: 0,
          workedMinutes: 0,
          leaveDays: 0,
          version: { increment: 1 },
        },
      });
      continue;
    }

    const duplicate = await findDuplicatePayslip(
      employee.id,
      payrun.periodStart,
      payrun.periodEnd,
      payrun.id,
      tx,
    );
    const worked = await computeWorkedFacts(
      employee.id,
      payrun.periodStart,
      payrun.periodEnd,
      tx,
    );

    let ruleError: string | null = null;
    let result: ComputeResult | null = null;
    try {
      result = computePayslip(rules, {
        wage: contract.wageMonthly,
        worked: {
          days: worked.days,
          minutes: worked.minutes,
          leaveDays: worked.leaveDays,
          overtimeMinutes: worked.overtimeMinutes,
        },
        employee: {
          seniorityYears: seniorityYears(payrun.periodStart, employee.joinDate),
        },
      });
    } catch (error) {
      ruleError =
        error instanceof PayrollComputationError
          ? error.message
          : 'Salary computation failed unexpectedly';
    }

    await replacePayslipWarnings(
      tx,
      payrun.id,
      payslip.id,
      buildPayslipWarnings({
        fullName,
        hasContract: true,
        ruleError,
        duplicatePayrunName: duplicate?.payrunName ?? null,
        missingBankAccount: employee.bankAccount === null,
        incompleteEmployee: isEmployeeIncomplete(employee),
        contractExpiring: isContractExpiringSoon(
          contract.endDate,
          payrun.periodEnd,
        ),
      }),
    );

    // Rule P9: delete this payslip's lines and rewrite them, never append.
    await tx.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
    if (result !== null) {
      await tx.payslipLine.createMany({
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
    }

    await tx.payslip.update({
      where: { id: payslip.id },
      data: {
        contractId: contract.id,
        contractWage: contract.wageMonthly,
        workedDays: worked.days,
        workedMinutes: worked.minutes,
        leaveDays: worked.leaveDays,
        basicAmount: result?.totals.basic ?? 0,
        allowanceAmount: result?.totals.allowance ?? 0,
        grossAmount: result?.totals.gross ?? 0,
        deductionAmount: result?.totals.deduction ?? 0,
        netAmount: result?.totals.net ?? 0,
        status: 'DONE',
        version: { increment: 1 },
      },
    });
  }
}
