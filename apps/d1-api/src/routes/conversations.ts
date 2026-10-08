/**
 * Conversations route handler for the D1 API Worker
 *
 * POST /conversations/get-or-create
 * GET  /conversations/:id/messages
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { generateId, now, parseBody, requireFields } from '../db';

interface GetOrCreateConversationBody {
  user_id: string;
}

interface GetMessagesQuery {
  limit?: number;
}

export async function handleConversations(
  request: Request,
  env: Env,
  action: 'get-or-create' | 'get-messages',
  conversationId?: string
): Promise<Response> {
  if (action === 'get-or-create') {
    return getOrCreateConversation(request, env);
  }
  if (action === 'get-messages' && conversationId) {
    return getConversationMessages(request, env, conversationId);
  }
  return jsonResponse({ error: 'Unknown action' }, 400);
}

async function getOrCreateConversation(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['user_id']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as GetOrCreateConversationBody;
  const userId = String(data.user_id).trim();

  try {
    // Check for existing active conversation
    const existing = await env.DB.prepare(
      `SELECT id, user_id, status, created_at, updated_at
       FROM conversations
       WHERE user_id = ? AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`
    )
      .bind(userId)
      .first();

    if (existing) {
      // Update the updated_at timestamp to keep the conversation active
      const timestamp = now();
      await env.DB.prepare(
        `UPDATE conversations SET updated_at = ? WHERE id = ?`
      )
        .bind(timestamp, existing.id)
        .run();

      return jsonResponse({ conversation: existing, created: false });
    }

    // Create a new conversation
    const id = generateId();
    const timestamp = now();

    await env.DB.prepare(
      `INSERT INTO conversations (id, user_id, status, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?)`
    )
      .bind(id, userId, timestamp, timestamp)
      .run();

    const conversation = await env.DB.prepare(
      `SELECT id, user_id, status, created_at, updated_at
       FROM conversations WHERE id = ?`
    )
      .bind(id)
      .first();

    return jsonResponse({ conversation, created: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] conversations/get-or-create error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}

async function getConversationMessages(
  request: Request,
  env: Env,
  conversationId: string
): Promise<Response> {
  const url = new URL(request.url);

  // Clamp limit between 1 and 50
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '15', 10);
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 15 : rawLimit, 1), 50);

  try {
    // Verify the conversation exists
    const conversation = await env.DB.prepare(
      `SELECT id FROM conversations WHERE id = ?`
    )
      .bind(conversationId)
      .first();

    if (!conversation) {
      return jsonResponse({ error: 'Conversation not found' }, 404);
    }

    // Get most recent messages, ordered ascending for chronological display
    const result = await env.DB.prepare(
      `SELECT id, conversation_id, whatsapp_message_id, direction,
              message_type, content, language, ai_generated, metadata, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
      .bind(conversationId, limit)
      .all();

    // Reverse so oldest is first (chronological order for context)
    const messages = (result.results ?? []).reverse();

    return jsonResponse({ messages, count: messages.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] conversations/:id/messages error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}
