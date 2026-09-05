import {
  createPayrunSchema,
  idSchema,
  payrunQuerySchema,
  payrunScopeSchema,
  workflowActionSchema,
  type CreatePayrunInput,
  type PayrunQuery,
  type PayrunScopeInput,
  type WorkflowAction,
} from '@payz/shared';
import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  requireAuth,
  requirePermission,
} from '../../middleware/auth.js';
import { conflict, notFound, unprocessable } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { renderPayslipPdf } from '../../pdf/payslip-document.js';
import { asyncRoute } from '../common/async-route.js';
import { getDefaultCompanyId } from '../common/company.js';
import { paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';
import { resolvePeriodContract } from '../contracts/resolve-period-contract.js';

import { computePayrunPayslips } from './compute.js';
import {
  resolveEligibleEmployees,
  toEligibilityResponse,
} from './eligibility.js';
import { getPayrunDetail, payrunListArgs, toPayrunRow } from './mappers.js';
import { payslipNumber } from './numbering.js';
import { loadPayslipPdfData } from './pdf-data.js';
import { sendPayslipsForPayrun } from './send-payslips.js';
import {
  canValidatePayrun,
  ensureComputable,
  ensureLegalTransition,
  ensureNotLocked,
  ensureSendable,
  unresolvedWarningReasons,
} from './workflow-guard.js';

export const payrunsRouter: Router = Router();

const warningParamsSchema = z.object({ id: idSchema, warningId: idSchema });

/** `req.body` version does not match the stored row (optimistic locking). */
function ensureVersionMatches(current: number, expected: number): void {
  if (current !== expected) {
    throw conflict(
      'This payrun has changed since it was loaded. Reload and try again.',
      { currentVersion: current, expectedVersion: expected },
    );
  }
}

/**
 * Rule W1: the only endpoint behind Continue. It only ever reads — there is
 * no create call anywhere on this path — which is what makes Continue
 * incapable of producing a payrun by itself.
 */
payrunsRouter.post(
  '/preview-eligible',
  requireAuth,
  requirePermission('read', 'payrun'),
  validate({ body: payrunScopeSchema }),
  asyncRoute(async (req, res) => {
    const scope = req.body as PayrunScopeInput;
    const result = await resolveEligibleEmployees(scope, undefined, prisma);
    res.json(toEligibilityResponse(result));
  }),
);

payrunsRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'payrun'),
  validate({ query: payrunQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as PayrunQuery;

    const where: Prisma.PayrunWhereInput = {};
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.year !== undefined) {
      where.periodStart = {
        gte: new Date(Date.UTC(query.year, 0, 1)),
        lt: new Date(Date.UTC(query.year + 1, 0, 1)),
      };
    }

    const [payruns, total] = await Promise.all([
      prisma.payrun.findMany({
        where,
        ...payrunListArgs,
        ...paginationArgs(query),
        orderBy: { periodStart: 'desc' },
      }),
      prisma.payrun.count({ where }),
    ]);

    res.json(toPaginated(payruns.map(toPayrunRow), total, query));
  }),
);

payrunsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('read', 'payrun'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const detail = await getPayrunDetail(prisma, id);
    if (detail === null) {
      throw notFound('Payrun not found');
    }
    res.json(detail);
  }),
);

/**
 * Step two of the wizard becomes real rows here (rule W2): eligibility is
 * recomputed from scratch against the database rather than trusting the
 * `EligibleEmployee[]` the client already has, so nothing about who ends up
 * in the payrun depends on a payload the browser could have tampered with.
 */
payrunsRouter.post(
  '/',
  requireAuth,
  requirePermission('create', 'payrun'),
  validate({ body: createPayrunSchema }),
  asyncRoute(async (req, res) => {
    const body = req.body as CreatePayrunInput;
    const uniqueIds = [...new Set(body.employeeIds)];

    const structure = await prisma.salaryStructure.findUnique({
      where: { id: body.salaryStructureId },
      select: { id: true, active: true },
    });
    if (structure === null) {
      throw notFound('Salary structure not found');
    }

    const { eligible, excluded } = await resolveEligibleEmployees(
      body,
      undefined,
      prisma,
    );
    const eligibleIds = new Set(eligible.map((e) => e.employeeId));
    const invalidIds = uniqueIds.filter((id) => !eligibleIds.has(id));

    if (invalidIds.length > 0) {
      const excludedReasons = new Map(
        excluded.map((e) => [e.employeeId, e.reason]),
      );
      throw unprocessable(
        'INELIGIBLE_EMPLOYEES',
        'Some selected employees are not eligible for this payrun.',
        {
          employeeIds: invalidIds,
          reasons: invalidIds.map((id) => ({
            employeeId: id,
            reason: excludedReasons.get(id) ?? 'No longer active or eligible',
          })),
        },
      );
    }

    const companyId = await getDefaultCompanyId();
    const year = body.periodStart.getUTCFullYear();
    const user = getUser(req);

    const payrunId = await prisma.$transaction(async (tx) => {
      const created = await tx.payrun.create({
        data: {
          name: body.name,
          companyId,
          salaryStructureId: body.salaryStructureId,
          employeeTypeScope: body.employeeTypeScope ?? null,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
          status: 'DRAFT',
          createdByUserId: user.id,
        },
      });

      let sequence = await tx.payslip.count();

      for (const employeeId of uniqueIds) {
        const contract = await resolvePeriodContract(
          employeeId,
          body.periodStart,
          body.periodEnd,
          tx,
        );
        // Re-checked a moment ago by resolveEligibleEmployees; still null here
        // only under a genuine race, which is worth failing loudly for.
        if (contract?.salaryStructureId !== body.salaryStructureId) {
          throw conflict(
            'An employee lost their applicable contract while this payrun was being created. Please retry.',
          );
        }

        sequence += 1;
        try {
          await tx.payslip.create({
            data: {
              number: payslipNumber(year, sequence),
              payrunId: created.id,
              employeeId,
              contractId: contract.id,
              structureId: body.salaryStructureId,
              periodStart: body.periodStart,
              periodEnd: body.periodEnd,
              contractWage: contract.wageMonthly,
              status: 'DRAFT',
            },
          });
        } catch (error) {
          // The partial unique index on (employeeId, periodStart, periodEnd)
          // makes paying someone twice for one period impossible. The wizard
          // flags this as duplicateWarning beforehand, but someone can select
          // the row anyway, or another run can land in between. Translate the
          // constraint into a message that names who, instead of a 500.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Not `tx`: the transaction is already aborted by the constraint
            // violation, so any further query on it fails too.
            const clash = await prisma.payslip.findFirst({
              where: {
                employeeId,
                periodStart: body.periodStart,
                periodEnd: body.periodEnd,
                status: { not: 'CANCELLED' },
              },
              select: {
                employee: { select: { firstName: true, lastName: true } },
                payrun: { select: { name: true } },
              },
            });
            const who =
              clash === null
                ? 'An employee'
                : `${clash.employee.firstName} ${clash.employee.lastName}`;
            const where =
              clash === null ? 'another payrun' : `"${clash.payrun.name}"`;
            throw conflict(
              `${who} already has a payslip for this period in ${where}. Deselect them, or cancel the other payrun.`,
            );
          }
          throw error;
        }
      }

      return created.id;
    });

    const detail = await getPayrunDetail(prisma, payrunId);
    res.status(201).json(detail);
  }),
);

payrunsRouter.post(
  '/:id/compute',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: idParamsSchema, body: workflowActionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const { version } = req.body as WorkflowAction;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureVersionMatches(payrun.version, version);
    ensureComputable(payrun.status);

    await prisma.$transaction(async (tx) => {
      await computePayrunPayslips(tx, payrun);

      const updated = await tx.payrun.updateMany({
        where: { id, version },
        data: {
          status: 'COMPUTED',
          computedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw conflict(
          'This payrun was updated concurrently. Reload and try again.',
        );
      }
    });

    res.json(await getPayrunDetail(prisma, id));
  }),
);

payrunsRouter.post(
  '/:id/validate',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: idParamsSchema, body: workflowActionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const { version } = req.body as WorkflowAction;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureVersionMatches(payrun.version, version);
    ensureLegalTransition(payrun.status, 'VALIDATED');

    const warnings = await prisma.payrollWarning.findMany({
      where: { payrunId: id },
      select: { blocking: true, acknowledgedAt: true },
    });
    if (!canValidatePayrun(warnings)) {
      throw conflict(
        'This payrun has unresolved warnings and cannot be validated.',
        {
          reasons: unresolvedWarningReasons(warnings),
        },
      );
    }

    const updated = await prisma.payrun.updateMany({
      where: { id, version },
      data: {
        status: 'VALIDATED',
        validatedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw conflict(
        'This payrun was updated concurrently. Reload and try again.',
      );
    }

    res.json(await getPayrunDetail(prisma, id));
  }),
);

payrunsRouter.post(
  '/:id/mark-paid',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: idParamsSchema, body: workflowActionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const { version } = req.body as WorkflowAction;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureVersionMatches(payrun.version, version);
    ensureLegalTransition(payrun.status, 'PAID');

    await prisma.$transaction(async (tx) => {
      const updated = await tx.payrun.updateMany({
        where: { id, version },
        data: { status: 'PAID', paidAt: new Date(), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw conflict(
          'This payrun was updated concurrently. Reload and try again.',
        );
      }
      await tx.payslip.updateMany({
        where: { payrunId: id, status: { not: 'CANCELLED' } },
        data: { status: 'PAID' },
      });
    });

    res.json(await getPayrunDetail(prisma, id));
  }),
);

payrunsRouter.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: idParamsSchema, body: workflowActionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const { version } = req.body as WorkflowAction;

    const payrun = await prisma.payrun.findUnique({ where: { id } });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureVersionMatches(payrun.version, version);
    ensureLegalTransition(payrun.status, 'CANCELLED');

    await prisma.$transaction(async (tx) => {
      const updated = await tx.payrun.updateMany({
        where: { id, version },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw conflict(
          'This payrun was updated concurrently. Reload and try again.',
        );
      }
      await tx.payslip.updateMany({
        where: { payrunId: id },
        data: { status: 'CANCELLED' },
      });
    });

    res.json(await getPayrunDetail(prisma, id));
  }),
);

/** Rule W8: only ever legal once the run has been validated. */
payrunsRouter.post(
  '/:id/send-payslips',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: idParamsSchema, body: workflowActionSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };
    const { version } = req.body as WorkflowAction;

    const payrun = await prisma.payrun.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        name: true,
        periodStart: true,
        periodEnd: true,
      },
    });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureVersionMatches(payrun.version, version);
    ensureSendable(payrun.status);

    const payslips = await prisma.payslip.findMany({
      where: { payrunId: id, status: { in: ['DONE', 'PAID'] } },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            workEmail: true,
          },
        },
      },
    });

    const periodLabel = `${payrun.periodStart.toISOString().slice(0, 10)} to ${payrun.periodEnd.toISOString().slice(0, 10)}`;

    const results = await sendPayslipsForPayrun(
      payslips.map((payslip) => ({
        payslipId: payslip.id,
        employeeId: payslip.employee.id,
        employeeEmail: payslip.employee.workEmail,
        employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
        number: payslip.number,
        periodLabel,
        netAmount: payslip.netAmount,
      })),
      async (payslipId) => {
        const detail = await loadPayslipPdfData(payslipId);
        return renderPayslipPdf(detail);
      },
    );

    const successfulIds = results
      .filter((r) => r.success)
      .map((r) => r.payslipId);

    await prisma.$transaction(async (tx) => {
      if (successfulIds.length > 0) {
        await tx.payslip.updateMany({
          where: { id: { in: successfulIds } },
          data: { emailSentAt: new Date() },
        });
      }
      const updated = await tx.payrun.updateMany({
        where: { id, version },
        data: { payslipsSentAt: new Date(), version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw conflict(
          'This payrun was updated concurrently. Reload and try again.',
        );
      }
    });

    res.json({
      sent: successfulIds.length,
      failed: results.length - successfulIds.length,
      // The wire boundary again: the send ran on integer ids, the browser
      // reads strings.
      results: results.map((result) => ({
        ...result,
        payslipId: String(result.payslipId),
        employeeId: String(result.employeeId),
      })),
      payrun: await getPayrunDetail(prisma, id),
    });
  }),
);

/** Rule W6: only advisory warnings can be acknowledged; blocking ones must be fixed and recomputed. */
payrunsRouter.post(
  '/:id/warnings/:warningId/acknowledge',
  requireAuth,
  requirePermission('update', 'payrun'),
  validate({ params: warningParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id, warningId } = req.params as unknown as {
      id: number;
      warningId: number;
    };
    const user = getUser(req);

    const payrun = await prisma.payrun.findUnique({
      where: { id },
      select: { status: true },
    });
    if (payrun === null) {
      throw notFound('Payrun not found');
    }
    ensureNotLocked(payrun.status);

    const warning = await prisma.payrollWarning.findUnique({
      where: { id: warningId },
    });
    if (warning?.payrunId !== id) {
      throw notFound('Warning not found on this payrun');
    }
    if (warning.blocking) {
      throw conflict(
        'This is a blocking warning. Fix the underlying issue and recompute; it cannot be acknowledged away.',
      );
    }

    await prisma.payrollWarning.update({
      where: { id: warningId },
      data: { acknowledgedAt: new Date(), acknowledgedByUserId: user.id },
    });

    res.json(await getPayrunDetail(prisma, id));
  }),
);
