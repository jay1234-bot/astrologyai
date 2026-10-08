/**
 * Message Service
 *
 * Handles storing messages to D1 via the D1 API Worker
 */

import { getD1Client, isD1Available } from '../../clients/d1-api.client.js';
import { logger } from '../../utils/logger.js';
import type { D1Message } from '../../clients/d1-api.client.js';

export class MessageService {
  /**
   * Store an inbound message from the customer
   */
  async storeInbound(params: {
    conversationId: string;
    whatsappMessageId: string;
    messageType: string;
    content?: string;
    language?: string;
    metadata?: Record<string, unknown>;
  }): Promise<D1Message | null> {
    return this.store({
      conversation_id: params.conversationId,
      whatsapp_message_id: params.whatsappMessageId,
      direction: 'inbound',
      message_type: params.messageType,
      content: params.content,
      language: params.language,
      ai_generated: false,
      metadata: params.metadata,
    });
  }

  /**
   * Store an outbound AI-generated response
   */
  async storeOutbound(params: {
    conversationId: string;
    content: string;
    language: string;
    aiGenerated: boolean;
  }): Promise<D1Message | null> {
    return this.store({
      conversation_id: params.conversationId,
      direction: 'outbound',
      message_type: 'text',
      content: params.content,
      language: params.language,
      ai_generated: params.aiGenerated,
    });
  }

  private async store(params: {
    conversation_id: string;
    whatsapp_message_id?: string;
    direction: 'inbound' | 'outbound';
    message_type: string;
    content?: string;
    language?: string;
    ai_generated: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<D1Message | null> {
    if (!isD1Available()) {
      logger.debug('D1 not available, skipping message storage');
      return null;
    }

    try {
      const client = getD1Client();
      return await client.createMessage(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to store message', { error: message });
      return null;
    }
  }
}

// Singleton
let _messageService: MessageService | null = null;

export function getMessageService(): MessageService {
  if (!_messageService) {
    _messageService = new MessageService();
  }
  return _messageService;
}
