/**
 * Users route handler for the D1 API Worker
 * POST /users/get-or-create
 *
 * Gets an existing user by whatsapp_user_id or creates a new one.
 * Uses INSERT OR IGNORE + SELECT pattern for race-condition safety in SQLite.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { generateId, now, parseBody, requireFields } from '../db';

interface GetOrCreateUserBody {
  whatsapp_user_id: string;
  phone_number?: string;
  display_name?: string;
  preferred_language?: string;
}

export async function handleUsers(
  request: Request,
  env: Env,
  action: 'get-or-create'
): Promise<Response> {
  if (action === 'get-or-create') {
    return getOrCreateUser(request, env);
  }
  return jsonResponse({ error: 'Unknown action' }, 400);
}

async function getOrCreateUser(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['whatsapp_user_id']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as GetOrCreateUserBody;
  const whatsappUserId = String(data.whatsapp_user_id).trim();
  const phoneNumber = data.phone_number ? String(data.phone_number).trim() : null;
  const displayName = data.display_name ? String(data.display_name).trim() : null;
  const preferredLanguage = data.preferred_language
    ? String(data.preferred_language).trim()
    : 'en';

  // Validate language code
  const allowedLanguages = ['en', 'hi', 'mr'];
  const lang = allowedLanguages.includes(preferredLanguage) ? preferredLanguage : 'en';

  const timestamp = now();
  const id = generateId();

  try {
    // Atomic upsert: try to insert, ignore conflict on unique whatsapp_user_id
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users
        (id, whatsapp_user_id, phone_number, display_name, preferred_language, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, whatsappUserId, phoneNumber, displayName, lang, timestamp, timestamp)
      .run();

    // Fetch the user (whether newly created or existing)
    const user = await env.DB.prepare(
      `SELECT id, whatsapp_user_id, phone_number, display_name, preferred_language, created_at, updated_at
       FROM users WHERE whatsapp_user_id = ?`
    )
      .bind(whatsappUserId)
      .first();

    if (!user) {
      return jsonResponse({ error: 'Failed to get or create user' }, 500);
    }

    return jsonResponse({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] users/get-or-create error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}
