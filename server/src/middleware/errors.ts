import { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Application errors carry an HTTP status and a stable machine-readable code,
 * so the client can branch on `code` rather than parsing prose.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const badRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Authentication required'): AppError =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Insufficient permissions'): AppError =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Resource not found'): AppError =>
  new AppError(404, 'NOT_FOUND', message);

/** Used for illegal workflow transitions and optimistic-lock mismatches. */
export const conflict = (message: string, details?: unknown): AppError =>
  new AppError(409, 'CONFLICT', message, details);

/** A business rule refused the operation: insufficient leave balance, and such. */
export const unprocessable = (
  code: string,
  message: string,
  details?: unknown,
): AppError => new AppError(422, code, message, details);

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `No route for ${req.method} ${req.path}`,
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fieldErrors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled error');

  // Prisma error text and stack traces never reach the client (guardrail 10.1).
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: isProduction
      ? 'Something went wrong'
      : error instanceof Error
        ? error.message
        : 'Unknown error',
  });
}
