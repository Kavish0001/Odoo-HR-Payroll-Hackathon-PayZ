import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

/**
 * Wraps an async controller so a rejection reaches the central error handler
 * instead of becoming an unhandled rejection.
 *
 * Mirrors the try/catch-then-`next(error)` pattern used inline in
 * auth.routes.ts, factored out because every HR module route needs the exact
 * same wiring.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    })();
  };
}
