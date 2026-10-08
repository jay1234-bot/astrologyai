/**
 * Conversation Service
 *
 * Manages conversation sessions and retrieves history for AI context.
 */

import { getD1Client, isD1Available } from '../../clients/d1-api.client.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import type { ConversationMessage } from '../../types/ai.types.js';
import type { D1Conversation, D1Message } from '../../clients/d1-api.client.js';

export class ConversationService {
  /**
   * Get or create an active conversation for a user
   */
  async getOrCreateConversation(userId: string): Promise<D1Conversation | null> {
    if (!isD1Available()) {
      logger.debug('D1 not available, skipping conversation creation');
      return null;
    }

    try {
      const client = getD1Client();
      return await client.getOrCreateConversation(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to get/create conversation', { error: message });
      return null;
    }
  }

  /**
   * Get recent conversation messages formatted for AI context
   */
  async getConversationHistory(conversationId: string): Promise<ConversationMessage[]> {
    if (!isD1Available()) {
      return [];
    }

    try {
      const client = getD1Client();
      const limit = env.AI_CONTEXT_MESSAGE_LIMIT;
      const messages = await client.getConversationMessages(conversationId, limit);
      return this.formatForAi(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to retrieve conversation history', { error: message });
      return [];
    }
  }

  /**
   * Convert D1 messages to AI conversation format
   */
  private formatForAi(messages: D1Message[]): ConversationMessage[] {
    return messages
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      }));
  }
}

// Singleton
let _conversationService: ConversationService | null = null;

export function getConversationService(): ConversationService {
  if (!_conversationService) {
    _conversationService = new ConversationService();
  }
  return _conversationService;
}
