/**
 * Error middleware for Hono
 *
 * Centralized error handling — production responses never include stack traces.
 */

import type { Context } from 'hono';
import type { ErrorHandler } from 'hono';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/env.js';

export const errorMiddleware: ErrorHandler = (err, c: Context) => {
  // Log the error (stack trace only in development)
  const errorContext: Record<string, unknown> = {
    path: c.req.path,
    method: c.req.method,
    code: err instanceof AppError ? err.code : 'UNKNOWN_ERROR',
  };

  if (!isProduction) {
    errorContext['stack'] = err.stack;
  }

  if (err instanceof AppError && err.statusCode < 500) {
    logger.warn(`[${err.code}] ${err.message}`, errorContext);
  } else {
    logger.error(`Unhandled error: ${err.message}`, errorContext);
  }

  // Never expose stack traces or internal details in production
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
      },
      err.statusCode as Parameters<typeof c.json>[1]
    );
  }

  // Generic server error — never expose details
  return c.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    500
  );
};
