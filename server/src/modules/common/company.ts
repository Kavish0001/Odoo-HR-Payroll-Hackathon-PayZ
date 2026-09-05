import { prisma } from '../../config/prisma.js';

/**
 * The single seeded company every HR record hangs off ("single seeded
 * company" per the design plan). Looked up rather than accepted from the
 * client, so a create can never be pointed at a tenant that does not exist.
 */
export async function getDefaultCompanyId(): Promise<string> {
  const company = await prisma.company.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (company === null) {
    throw new Error('No company is seeded; cannot create HR records');
  }

  return company.id;
}
