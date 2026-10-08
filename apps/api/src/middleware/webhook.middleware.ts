/**
 * Webhook middleware — Meta signature verification
 *
 * Validates X-Hub-Signature-256 HMAC before any processing.
 * Reads the raw body ONCE and stores it for controller use.
 * Rejects invalid signatures in production; warns in development.
 */

import type { MiddlewareHandler } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import { env, isProduction } from '../config/env.js';
import { WebhookSignatureError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const webhookSignatureMiddleware: MiddlewareHandler = async (c, next) => {
  // Only apply to POST /webhook
  if (c.req.method !== 'POST') {
    return next();
  }

  const signature = c.req.header('x-hub-signature-256');

  // Read raw body as text and store it
  const rawBody = await c.req.text();
  c.set('rawBody', rawBody);

  // In development without META_APP_SECRET configured, skip validation with warning
  if (!env.META_APP_SECRET) {
    if (!isProduction) {
      logger.warn(
        'META_APP_SECRET not configured — skipping webhook signature validation (development only)'
      );
      return next();
    }
    // In production, missing secret is a server configuration error
    logger.error('META_APP_SECRET not configured in production');
    throw new WebhookSignatureError('Webhook signature validation not configured');
  }

  if (!signature) {
    logger.warn('Webhook received without signature header');
    throw new WebhookSignatureError('Missing X-Hub-Signature-256 header');
  }

  // Validate signature
  if (!verifySignature(rawBody, signature, env.META_APP_SECRET)) {
    logger.warn('Webhook signature validation failed', {
      path: c.req.path,
      hasSignature: Boolean(signature),
    });
    throw new WebhookSignatureError('Invalid webhook signature');
  }

  logger.debug('Webhook signature verified');
  return next();
};

/**
 * Verify HMAC-SHA256 webhook signature using timing-safe comparison
 */
function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const receivedHex = signature.slice(7);
  const computed = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  try {
    const receivedBuf = Buffer.from(receivedHex, 'hex');
    const computedBuf = Buffer.from(computed, 'hex');

    if (receivedBuf.length !== computedBuf.length) {
      return false;
    }

    return timingSafeEqual(receivedBuf, computedBuf);
  } catch {
    return false;
  }
}
