import { type RequestHandler } from 'express';
import { type ZodTypeAny } from 'zod';

interface ValidationTargets {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Parses request input through Zod before the controller runs.
 *
 * Parsed output replaces the raw input, so controllers receive typed, coerced
 * data and never touch req.body directly. Zod strips unknown keys, which is
 * what blocks mass-assignment of fields like `roles`, `status` or
 * `wageMonthly` that no client should be able to set (guardrail 10.1).
 */
export function validate(targets: ValidationTargets): RequestHandler {
  return (req, _res, next) => {
    try {
      if (targets.body !== undefined) {
        // ZodTypeAny.parse is declared as returning any; route it through
        // unknown so no untyped value reaches a controller.
        const parsed: unknown = targets.body.parse(req.body);
        req.body = parsed;
      }

      if (targets.params !== undefined) {
        const parsed: unknown = targets.params.parse(req.params);
        Object.assign(req.params, parsed);
      }

      if (targets.query !== undefined) {
        // Express 5 makes req.query a getter, so it is redefined rather than
        // assigned.
        const parsed: unknown = targets.query.parse(req.query);
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }

      next();
    } catch (error) {
      // ZodError is turned into field errors by the central error handler.
      next(error);
    }
  };
}
