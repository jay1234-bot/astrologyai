/**
 * D1 API Client
 *
 * HTTP client for communicating with the Cloudflare Worker D1 API.
 * This is the ONLY place in the Render backend that talks to D1.
 *
 * All methods use typed request/response contracts.
 * Secrets are never logged.
 */

import { env } from '../config/env.js';
import { D1_API_TIMEOUT_MS } from '../config/constants.js';
import { D1ApiError, ConfigurationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { SupportedLanguage } from '../config/constants.js';
import type { KnowledgeDocument } from '../types/ai.types.js';

// ============================================================
// Response types
// ============================================================

export interface D1User {
  id: string;
  whatsapp_user_id: string;
  phone_number: string | null;
  display_name: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

export interface D1Conversation {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface D1Message {
  id: string;
  conversation_id: string;
  whatsapp_message_id: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string | null;
  language: string | null;
  ai_generated: number;
  metadata: string | null;
  created_at: string;
}

// ============================================================
// Client
// ============================================================

class D1ApiClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor() {
    if (!env.D1_API_URL || !env.D1_API_SECRET) {
      throw new ConfigurationError('D1_API_URL and D1_API_SECRET must be configured');
    }
    this.baseUrl = env.D1_API_URL.replace(/\/$/, ''); // remove trailing slash
    this.secret = env.D1_API_SECRET;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), D1_API_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secret}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `D1 API error: ${response.status}`;
        try {
          const errorBody = (await response.json()) as { error?: string };
          if (errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // ignore parse error
        }
        throw new D1ApiError(errorMessage, response.status);
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof D1ApiError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new D1ApiError('D1 API request timed out');
      }

      const message = err instanceof Error ? err.message : 'Unknown D1 API error';
      throw new D1ApiError(message);
    }
  }

  // ============================================================
  // Users
  // ============================================================

  async getOrCreateUser(params: {
    whatsapp_user_id: string;
    phone_number?: string;
    display_name?: string;
    preferred_language?: string;
  }): Promise<D1User> {
    const result = await this.request<{ user: D1User }>('POST', '/users/get-or-create', params);
    return result.user;
  }

  async updateUserLanguage(whatsappUserId: string, language: SupportedLanguage): Promise<D1User> {
    // Re-create the user record with updated language
    // The Worker handles this via upsert
    const result = await this.request<{ user: D1User }>('POST', '/users/get-or-create', {
      whatsapp_user_id: whatsappUserId,
      preferred_language: language,
    });
    return result.user;
  }

  // ============================================================
  // Conversations
  // ============================================================

  async getOrCreateConversation(userId: string): Promise<D1Conversation> {
    const result = await this.request<{ conversation: D1Conversation; created: boolean }>(
      'POST',
      '/conversations/get-or-create',
      { user_id: userId }
    );
    return result.conversation;
  }

  async getConversationMessages(conversationId: string, limit = 15): Promise<D1Message[]> {
    const result = await this.request<{ messages: D1Message[]; count: number }>(
      'GET',
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      undefined,
      { limit: String(limit) }
    );
    return result.messages;
  }

  // ============================================================
  // Messages
  // ============================================================

  async createMessage(params: {
    conversation_id: string;
    whatsapp_message_id?: string;
    direction: 'inbound' | 'outbound';
    message_type: string;
    content?: string;
    language?: string;
    ai_generated?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<D1Message> {
    const result = await this.request<{ message: D1Message }>('POST', '/messages', params);
    return result.message;
  }

  // ============================================================
  // Webhook deduplication
  // ============================================================

  async checkWebhookProcessed(whatsappMessageId: string): Promise<boolean> {
    const result = await this.request<{ already_processed: boolean }>(
      'POST',
      '/webhooks/check',
      { whatsapp_message_id: whatsappMessageId }
    );
    return result.already_processed;
  }

  async markWebhookProcessed(whatsappMessageId: string, eventType?: string): Promise<void> {
    await this.request('POST', '/webhooks/mark-processed', {
      whatsapp_message_id: whatsappMessageId,
      event_type: eventType,
    });
  }

  // ============================================================
  // Knowledge
  // ============================================================

  async searchKnowledge(params: {
    query: string;
    language?: string;
    category?: string;
    limit?: number;
  }): Promise<KnowledgeDocument[]> {
    const result = await this.request<{ documents: KnowledgeDocument[]; count: number }>(
      'POST',
      '/knowledge/search',
      params
    );
    return result.documents;
  }

  async listKnowledge(params?: {
    category?: string;
    language?: string;
    limit?: number;
  }): Promise<KnowledgeDocument[]> {
    const result = await this.request<{ documents: KnowledgeDocument[]; count: number }>(
      'POST',
      '/knowledge/list',
      params ?? {}
    );
    return result.documents;
  }

  // ============================================================
  // Health check
  // ============================================================

  async health(): Promise<boolean> {
    try {
      // Health endpoint doesn't require auth
      const url = `${this.baseUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================
// Singleton factory — avoids creating multiple instances
// ============================================================

let _d1Client: D1ApiClient | null = null;

export function getD1Client(): D1ApiClient {
  if (!_d1Client) {
    _d1Client = new D1ApiClient();
  }
  return _d1Client;
}

/**
 * Check if D1 is configured without throwing
 */
export function isD1Available(): boolean {
  return Boolean(env.D1_API_URL && env.D1_API_SECRET);
}
