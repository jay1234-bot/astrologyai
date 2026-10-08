/**
 * Messages route handler for the D1 API Worker
 * POST /messages
 *
 * Stores a new message (inbound or outbound)
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { generateId, now, parseBody, requireFields } from '../db';

interface CreateMessageBody {
  conversation_id: string;
  whatsapp_message_id?: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content?: string;
  language?: string;
  ai_generated?: boolean;
  metadata?: Record<string, unknown>;
}

export async function handleMessages(
  request: Request,
  env: Env,
  action: 'create'
): Promise<Response> {
  if (action === 'create') {
    return createMessage(request, env);
  }
  return jsonResponse({ error: 'Unknown action' }, 400);
}

async function createMessage(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['conversation_id', 'direction', 'message_type']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as CreateMessageBody;

  // Validate direction
  if (!['inbound', 'outbound'].includes(data.direction)) {
    return jsonResponse({ error: 'direction must be inbound or outbound' }, 400);
  }

  const id = generateId();
  const timestamp = now();
  const aiGenerated = data.ai_generated ? 1 : 0;
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
  const whatsappMessageId = data.whatsapp_message_id
    ? String(data.whatsapp_message_id).trim()
    : null;

  try {
    // Use INSERT OR IGNORE to handle potential duplicate whatsapp_message_id gracefully
    await env.DB.prepare(
      `INSERT OR IGNORE INTO messages
        (id, conversation_id, whatsapp_message_id, direction, message_type,
         content, language, ai_generated, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        String(data.conversation_id).trim(),
        whatsappMessageId,
        data.direction,
        String(data.message_type).trim(),
        data.content ? String(data.content) : null,
        data.language ? String(data.language).trim() : null,
        aiGenerated,
        metadataJson,
        timestamp
      )
      .run();

    // Fetch the created or existing message
    const message = whatsappMessageId
      ? await env.DB.prepare(
          `SELECT id, conversation_id, whatsapp_message_id, direction, message_type,
                  content, language, ai_generated, metadata, created_at
           FROM messages WHERE whatsapp_message_id = ?`
        )
          .bind(whatsappMessageId)
          .first()
      : await env.DB.prepare(
          `SELECT id, conversation_id, whatsapp_message_id, direction, message_type,
                  content, language, ai_generated, metadata, created_at
           FROM messages WHERE id = ?`
        )
          .bind(id)
          .first();

    return jsonResponse({ message }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] messages/create error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}
