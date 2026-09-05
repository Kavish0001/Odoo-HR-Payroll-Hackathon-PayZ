import { Router } from 'express';

import { prisma } from '../../config/prisma.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';

import { asyncRoute } from './async-route.js';

/**
 * The companies on this deployment.
 *
 * PayZ is single-tenant in practice -- `getDefaultCompanyId` hangs every new
 * HR record off the one seeded company -- but the dashboard still offers a
 * company filter, and a filter whose only option is a hardcoded "All
 * Companies" label tells the user nothing about what they are looking at.
 * This returns the real names so the control shows the employer whose payroll
 * is on screen, and lists more if a deployment ever has more.
 *
 * Guarded by the employee read permission rather than a company-specific one:
 * the company name is already on every payslip anyone here can open.
 */
export const companiesRouter: Router = Router();

export interface CompanyOption {
  id: string;
  name: string;
  legalName: string | null;
  currency: string;
}

companiesRouter.get(
  '/',
  requireAuth,
  requirePermission('read', 'employee'),
  asyncRoute(async (_req, res) => {
    const companies = await prisma.company.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, legalName: true, currency: true },
    });

    res.json(
      companies.map((company) => ({
        ...company,
        id: String(company.id),
      })),
    );
  }),
);
