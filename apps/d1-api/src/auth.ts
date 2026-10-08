/**
 * Authentication middleware for the D1 API Worker
 * Validates Bearer token against D1_API_SECRET
 */

import type { Env } from './index';
import { jsonResponse } from './index';

export function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Invalid Authorization format' }, 401);
  }

  const token = authHeader.slice(7);

  if (!env.D1_API_SECRET) {
    console.error('[D1-API] D1_API_SECRET is not configured');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(token, env.D1_API_SECRET)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return null; // Authentication passed
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid early exit timing info
    let result = 1;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      result |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
