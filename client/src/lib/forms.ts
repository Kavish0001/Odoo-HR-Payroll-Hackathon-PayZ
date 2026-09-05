import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodTypeAny } from 'zod';

/**
 * Wraps zodResolver with the signature it actually has at runtime: it
 * validates the raw (uncontrolled-input) form values against `schema` and
 * hands react-hook-form the *parsed* result — Dates coerced, ids trimmed to
 * undefined, defaults applied. The installed @hookform/resolvers version
 * types its return generically as the raw input type only, so every form
 * that submits a transformed shape needs this cast to get an accurate
 * `TTransformedValues` on `handleSubmit`.
 *
 * Both type parameters must be supplied explicitly at the call site
 * (`typedZodResolver<FormValues, Input>(schema)`) — a zod schema's input
 * shape (pre-transform) is usually not assignable to its output shape, so
 * letting TS infer TTransformed from `schema` directly produces spurious
 * mismatches against a transform-heavy schema like a date or money field.
 */
export function typedZodResolver<
  TFieldValues extends FieldValues,
  TTransformed,
>(schema: ZodTypeAny): Resolver<TFieldValues, unknown, TTransformed> {
  return zodResolver(schema) as unknown as Resolver<
    TFieldValues,
    unknown,
    TTransformed
  >;
}

/** For a <select>/<input> bound with register: '' means "not set". */
export function emptyToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value;
}

/** For a numeric <input>: '' means "not set", otherwise parse to a number. */
export function emptyToUndefinedNumber(value: string): number | undefined {
  return value === '' ? undefined : Number(value);
}
