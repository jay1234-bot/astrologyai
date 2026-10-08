/**
 * Logging middleware for Hono
 * Logs structured request/response info — never logs sensitive headers.
 */

import type { MiddlewareHandler } from 'hono';
import { logger } from '../utils/logger.js';

// Headers that must NEVER be logged
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-hub-signature-256',
  'x-hub-signature',
  'cookie',
  'set-cookie',
]);

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  // Store request ID for downstream use
  c.set('requestId', requestId);

  // Log safe headers only
  const safeHeaders: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
      safeHeaders[key] = value;
    }
  });

  logger.info('Request received', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    contentType: c.req.header('content-type'),
    userAgent: c.req.header('user-agent'),
  });

  await next();

  const durationMs = Date.now() - start;

  logger.info('Request completed', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
  });
};
