import {
  ownRecordsOnly,
  payslipQuerySchema,
  type PayslipQuery,
} from '@payz/shared';
import { type Prisma } from '@prisma/client';
import { type Request, Router } from 'express';

import { prisma } from '../../config/prisma.js';
import {
  getUser,
  requireAuth,
  requirePermission,
} from '../../middleware/auth.js';
import { forbidden, notFound } from '../../middleware/errors.js';
import { validate } from '../../middleware/validate.js';
import { renderPayslipPdf } from '../../pdf/payslip-document.js';
import { asyncRoute } from '../common/async-route.js';
import { paginationArgs, toPaginated } from '../common/pagination.js';
import { idParamsSchema } from '../common/params.js';

import {
  payslipDetailArgs,
  payslipWithRelationsArgs,
  toPayslipDetail,
  toPayslipRow,
} from './mappers.js';
import { loadPayslipPdfData } from './pdf-data.js';

/**
 * Payslip reads. There is no write path here at all — Compute and Validate
 * (in payruns.routes.ts) are the only things that ever change a payslip's
 * numbers, matching rule P9's "delete and rewrite the lines" contract.
 */
export const payslipsRouter: Router = Router();

/**
 * The ownership rule for payslips, in one place.
 *
 * Two audiences reach these routes. Payroll staff hold `read` and see the
 * whole batch. Everybody else -- an employee, and equally an HR Manager, who
 * has no payroll access at all under rule R3 -- holds only `readSelf`, and
 * sees exactly one person's payslips: their own.
 *
 * The role-rank helpers are the wrong instrument here. They ask whether the
 * caller's *role* is self-scoped, which is true only of EMPLOYEE, and would
 * therefore wave an HR Manager through to anybody's pay. This asks about the
 * resource instead.
 */
function ownPayslipFilter(req: Request): { employeeId?: number } {
  const user = getUser(req);
  if (!ownRecordsOnly(user.roles, 'payslip')) {
    return {};
  }
  if (user.employeeId === null) {
    throw forbidden('This account is not linked to an employee record');
  }
  return { employeeId: user.employeeId };
}

function assertPayslipVisible(req: Request, employeeId: number): void {
  const own = ownPayslipFilter(req);
  if (own.employeeId !== undefined && own.employeeId !== employeeId) {
    throw forbidden('You may only view your own payslips');
  }
}

payslipsRouter.get(
  '/',
  requireAuth,
  requirePermission('readSelf', 'payslip'),
  validate({ query: payslipQuerySchema }),
  asyncRoute(async (req, res) => {
    const query = req.query as unknown as PayslipQuery;

    const where: Prisma.PayslipWhereInput = {};
    if (query.payrunId !== undefined) {
      where.payrunId = query.payrunId;
    }
    if (query.employeeId !== undefined) {
      where.employeeId = query.employeeId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }

    // Applied last, so it overwrites any employeeId the client asked for
    // rather than being overwritten by it.
    Object.assign(where, ownPayslipFilter(req));

    const [payslips, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        ...payslipWithRelationsArgs,
        ...paginationArgs(query),
        orderBy: { periodStart: 'desc' },
      }),
      prisma.payslip.count({ where }),
    ]);

    res.json(toPaginated(payslips.map(toPayslipRow), total, query));
  }),
);

payslipsRouter.get(
  '/:id',
  requireAuth,
  requirePermission('readSelf', 'payslip'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      ...payslipDetailArgs,
    });
    if (payslip === null) {
      throw notFound('Payslip not found');
    }
    assertPayslipVisible(req, payslip.employeeId);

    res.json(toPayslipDetail(payslip));
  }),
);

/**
 * Streams the payslip PDF. Runs the exact same role and ownership checks as
 * the JSON detail route above — an EMPLOYEE caller may only ever reach their
 * own payslip's PDF, never a colleague's.
 */
payslipsRouter.get(
  '/:id/pdf',
  requireAuth,
  requirePermission('readSelf', 'payslip'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: number };

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true, number: true },
    });
    if (payslip === null) {
      throw notFound('Payslip not found');
    }
    assertPayslipVisible(req, payslip.employeeId);

    const data = await loadPayslipPdfData(id);
    const buffer = await renderPayslipPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${payslip.number.replace(/\//g, '-')}.pdf"`,
    );
    res.send(buffer);
  }),
);
