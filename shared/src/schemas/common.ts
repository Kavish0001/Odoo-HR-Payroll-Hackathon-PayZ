import { z } from 'zod';

/**
 * Primitives every entity schema is built from.
 *
 * These live in shared so the API validator and the React form resolver are
 * literally the same object. A field that tightens here tightens in both
 * places at the next compile, which is the whole reason for the package.
 */

/**
 * A database id, coerced from whatever the wire delivered.
 *
 * Postgres stores these as `int4`, which is what makes the joins and indexes
 * cheap, but JSON carries them as strings: a route param is always a string,
 * a query string is always a string, and the DTOs the API returns keep them
 * as strings so the browser never has to care.
 *
 * The union-then-pipe is what makes both sides true at once: the *input* is
 * `string | number`, so a form that holds the string a `<select>` gave it
 * still typechecks, while the *output* is always a number, so a route handler
 * that reads a parsed body gets an integer. A bare `z.coerce.number()` types
 * its input as `number` and would reject the caller that has a string.
 */
export const idSchema = z
  .union([z.string(), z.number()])
  .pipe(z.coerce.number().int('Invalid id').positive('Invalid id'));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

/**
 * Accepts a Date or an ISO string and always yields a Date, so a value coming
 * from JSON and one coming from a date picker land in the same shape.
 */
export const dateSchema = z.coerce.date();

/** A date-only field, normalised to midnight UTC so period maths is stable. */
export const daySchema = z.coerce.date().transform((value) => {
  const normalised = new Date(value);
  normalised.setUTCHours(0, 0, 0, 0);
  return normalised;
});

/**
 * Money entered by a user, in rupees. Rejects more than two decimal places
 * rather than silently rounding away part of someone's salary.
 *
 * Validates the amount; it does not convert it. This schema used to end in
 * `.transform(rupees => rupees * 100)`, which is applied wherever the schema
 * is -- and the same schema is the resolver on a React form and the validator
 * on the API route. A wage therefore went through the conversion twice and
 * reached the database a hundred times too large: a ₹50,000 contract saved as
 * ₹50,00,000.
 *
 * Converting to paise is the persistence layer's job, and it happens once,
 * where the value is written (`rupeesToPaise`). A schema that quietly changes
 * the units of its input hides that step from both sides.
 */
export const rupeesSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine(
    (value) =>
      Number.isInteger(Math.round(value * 100)) &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
    'At most two decimal places',
  );

/** Already-integer paise, for values moving between services. */
export const paiseSchema = z.number().int();

export const percentageSchema = z
  .number()
  .min(0, 'Cannot be negative')
  .max(100, 'Cannot exceed 100%');

/** Minutes from midnight, 0..1440. */
export const minuteOfDaySchema = z
  .number()
  .int()
  .min(0, 'Must be at or after 00:00')
  .max(1440, 'Must be at or before 24:00');

export const nonEmptyString = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

/** Optional text where empty input should mean "not provided", not "". */
export const optionalString = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

/**
 * A closed or open-ended date range. Used by contracts, allocations and
 * payroll periods, so the ordering rule is stated once.
 */
export const dateRangeSchema = z
  .object({
    startDate: daySchema,
    endDate: daySchema.nullish(),
  })
  .refine(
    ({ startDate, endDate }) =>
      endDate === null || endDate === undefined || endDate >= startDate,
    { message: 'End date cannot be before the start date', path: ['endDate'] },
  );

/** Standard list-query envelope shared by every list endpoint. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export type Pagination = z.infer<typeof paginationSchema>;

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
