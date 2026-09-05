import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { asyncRoute } from '../common/async-route.js';

/**
 * Public workspace counts, for the landing page.
 *
 * Deliberately unauthenticated, because the landing page sits outside the
 * signed-in application. Equally deliberately, it returns nothing but row
 * counts: no names, no salary figures, nothing identifying a person. A public
 * endpoint gets exactly the data a public page needs and no more.
 *
 * It exists so the marketing page can stop claiming figures it has typed into
 * itself. A page asserting "no hardcoded values" while hardcoding its own
 * numbers is the precise failure the brief warns about.
 */
export const statsRouter: Router = Router();

export interface PublicStats {
  employees: number;
  payrollPeriods: number;
  payslips: number;
  payslipLines: number;
  attendanceRecords: number;
  salaryRules: number;
}

statsRouter.get(
  '/',
  asyncRoute(async (_req, res) => {
    const [
      employees,
      payrollPeriods,
      payslips,
      payslipLines,
      attendanceRecords,
      salaryRules,
    ] = await Promise.all([
      prisma.employee.count({ where: { active: true } }),
      prisma.payrun.count(),
      prisma.payslip.count(),
      prisma.payslipLine.count(),
      prisma.attendance.count(),
      prisma.salaryRule.count({ where: { active: true } }),
    ]);

    const stats: PublicStats = {
      employees,
      payrollPeriods,
      payslips,
      payslipLines,
      attendanceRecords,
      salaryRules,
    };

    // Counts change only when the workspace does, so a minute of caching
    // spares the database a query per landing-page view.
    res.set('Cache-Control', 'public, max-age=60');
    res.json(stats);
  }),
);
