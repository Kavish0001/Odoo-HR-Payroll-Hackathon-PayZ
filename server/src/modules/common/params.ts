import { idSchema } from '@payz/shared';
import { z } from 'zod';

/** `{ id }` route param, validated as a Prisma cuid. */
export const idParamsSchema = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParamsSchema>;
