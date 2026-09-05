import { PrismaClient } from '@prisma/client';

import { env, isProduction } from './env.js';

/**
 * A single client for the process. In dev, tsx watch reloads the module on
 * every save, so the instance is cached on globalThis to avoid exhausting
 * the connection pool with a new client per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/** Backs GET /api/health: the first thing to check when a demo breaks. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export const databaseHost = new URL(env.DATABASE_URL).host;
