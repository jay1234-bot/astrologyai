/**
 * Webhooks route handler for the D1 API Worker
 *
 * POST /webhooks/check         — Check if message was already processed
 * POST /webhooks/mark-processed — Mark a message as processed
 *
 * Used for Meta webhook deduplication.
 * Meta may retry webhook delivery, so we track processed message IDs.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { generateId, now, parseBody, requireFields } from '../db';

interface CheckWebhookBody {
  whatsapp_message_id: string;
}

interface MarkProcessedBody {
  whatsapp_message_id: string;
  event_type?: string;
}

export async function handleWebhooks(
  request: Request,
  env: Env,
  action: 'check' | 'mark-processed'
): Promise<Response> {
  if (action === 'check') {
    return checkWebhook(request, env);
  }
  if (action === 'mark-processed') {
    return markWebhookProcessed(request, env);
  }
  return jsonResponse({ error: 'Unknown action' }, 400);
}

async function checkWebhook(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['whatsapp_message_id']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as CheckWebhookBody;
  const messageId = String(data.whatsapp_message_id).trim();

  try {
    const existing = await env.DB.prepare(
      `SELECT id, whatsapp_message_id, event_type, processed_at
       FROM processed_webhooks
       WHERE whatsapp_message_id = ?`
    )
      .bind(messageId)
      .first();

    return jsonResponse({
      already_processed: existing !== null,
      webhook: existing ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] webhooks/check error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}

async function markWebhookProcessed(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['whatsapp_message_id']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as MarkProcessedBody;
  const messageId = String(data.whatsapp_message_id).trim();
  const eventType = data.event_type ? String(data.event_type).trim() : null;

  const id = generateId();
  const timestamp = now();

  try {
    // INSERT OR IGNORE — if already exists, silently ignore
    // This handles race conditions where two webhook deliveries arrive simultaneously
    await env.DB.prepare(
      `INSERT OR IGNORE INTO processed_webhooks
        (id, whatsapp_message_id, event_type, processed_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(id, messageId, eventType, timestamp)
      .run();

    // Check what was actually stored
    const stored = await env.DB.prepare(
      `SELECT id, whatsapp_message_id, event_type, processed_at
       FROM processed_webhooks WHERE whatsapp_message_id = ?`
    )
      .bind(messageId)
      .first();

    return jsonResponse({ webhook: stored });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] webhooks/mark-processed error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}
