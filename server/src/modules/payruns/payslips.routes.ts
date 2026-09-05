import { payslipQuerySchema, type PayslipQuery } from '@payz/shared';
import { type Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import {
  mustBeSelf,
  requireAuth,
  requirePermission,
  selfScope,
} from '../../middleware/auth.js';
import { notFound } from '../../middleware/errors.js';
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

payslipsRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'payslip'),
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

    // R2 (defence in depth): a self-scoped caller only ever sees their own
    // payslips, whatever employeeId the client asked for.
    Object.assign(where, selfScope(req));

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
  requirePermission('read', 'payslip'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      ...payslipDetailArgs,
    });
    if (payslip === null) {
      throw notFound('Payslip not found');
    }
    mustBeSelf(req, payslip.employeeId);

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
  requirePermission('read', 'payslip'),
  validate({ params: idParamsSchema }),
  asyncRoute(async (req, res) => {
    const { id } = req.params as unknown as { id: string };

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true, number: true },
    });
    if (payslip === null) {
      throw notFound('Payslip not found');
    }
    mustBeSelf(req, payslip.employeeId);

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
