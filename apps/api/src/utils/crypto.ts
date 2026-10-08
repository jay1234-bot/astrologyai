/**
 * Crypto utilities
 * HMAC SHA-256 verification for Meta webhook signatures
 */

import { createHmac, timingSafeEqual, randomFillSync } from 'crypto';

/**
 * Verify a Meta WhatsApp Cloud API webhook signature.
 *
 * Meta sends:  X-Hub-Signature-256: sha256=<hmac>
 * We compute: HMAC-SHA256(META_APP_SECRET, rawBody)
 * And compare using constant-time comparison.
 *
 * @param rawBody  - Raw request body as Buffer or string
 * @param signature - Full header value including "sha256=" prefix
 * @param secret   - META_APP_SECRET
 * @returns true if valid, false otherwise
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // Strip the "sha256=" prefix
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    return false;
  }

  const receivedHex = signature.slice(expectedPrefix.length);

  // Compute our HMAC
  const computed = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison
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

/**
 * Generate a random string suitable for use as a secret token
 * Not for use as a cryptographic key — just for WHATSAPP_VERIFY_TOKEN
 */
export function generateVerifyToken(): string {
  const buf = Buffer.alloc(32);
  randomFillSync(buf);
  return buf.toString('hex');
}
