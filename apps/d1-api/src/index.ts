/**
 * Cloudflare Worker D1 API — Main entry point
 * Secure database API for पंडित हरिनाथ शास्त्री AI chatbot
 *
 * This Worker acts as a secure proxy between the Render backend
 * and Cloudflare D1. It authenticates all requests using a shared
 * secret and only allows predefined parameterized queries.
 *
 * NEVER expose D1 credentials publicly.
 * NEVER allow arbitrary SQL execution.
 */

import { authenticate } from './auth';
import { handleUsers } from './routes/users';
import { handleConversations } from './routes/conversations';
import { handleMessages } from './routes/messages';
import { handleKnowledge } from './routes/knowledge';
import { handleWebhooks } from './routes/webhooks';

export interface Env {
  DB: D1Database;
  D1_API_SECRET: string;
  ENVIRONMENT?: string;
}

// ============================================================
// Router
// ============================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }));
    }

    // Health check — no auth required
    if (path === '/health' && method === 'GET') {
      return corsResponse(
        jsonResponse({
          status: 'ok',
          service: 'd1-api',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT ?? 'unknown',
        })
      );
    }

    // Authenticate all other routes
    const authError = authenticate(request, env);
    if (authError) {
      return corsResponse(authError);
    }

    // Route dispatch
    try {
      // Users
      if (path === '/users/get-or-create' && method === 'POST') {
        return corsResponse(await handleUsers(request, env, 'get-or-create'));
      }

      // Conversations
      if (path === '/conversations/get-or-create' && method === 'POST') {
        return corsResponse(await handleConversations(request, env, 'get-or-create'));
      }

      const conversationMessagesMatch = path.match(/^\/conversations\/([^/]+)\/messages$/);
      if (conversationMessagesMatch && method === 'GET') {
        const conversationId = conversationMessagesMatch[1];
        return corsResponse(await handleConversations(request, env, 'get-messages', conversationId));
      }

      // Messages
      if (path === '/messages' && method === 'POST') {
        return corsResponse(await handleMessages(request, env, 'create'));
      }

      // Webhooks (deduplication)
      if (path === '/webhooks/check' && method === 'POST') {
        return corsResponse(await handleWebhooks(request, env, 'check'));
      }

      if (path === '/webhooks/mark-processed' && method === 'POST') {
        return corsResponse(await handleWebhooks(request, env, 'mark-processed'));
      }

      // Knowledge
      if (path === '/knowledge/search' && method === 'POST') {
        return corsResponse(await handleKnowledge(request, env, 'search'));
      }

      if (path === '/knowledge/list' && method === 'POST') {
        return corsResponse(await handleKnowledge(request, env, 'list'));
      }

      return corsResponse(jsonResponse({ error: 'Not found' }, 404));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('[D1-API] Unhandled error:', message);
      return corsResponse(jsonResponse({ error: 'Internal server error' }, 500));
    }
  },
} satisfies ExportedHandler<Env>;

// ============================================================
// Helpers
// ============================================================

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function corsResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  // Restrict CORS to your Render domain in production
  // For development, allow all origins
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
