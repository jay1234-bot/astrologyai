/**
 * WhatsApp Cloud API HTTP Client
 *
 * SINGLE source of truth for the WhatsApp API base URL and version.
 * All WhatsApp API calls go through this client.
 * Never scatter URLs throughout the codebase.
 */

import { WHATSAPP_API_BASE_URL, WHATSAPP_API_VERSION } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { WhatsAppApiError, ConfigurationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type {
  SendTextMessagePayload,
  SendImageMessagePayload,
  SendDocumentMessagePayload,
  SendInteractiveMessagePayload,
  WhatsAppApiSendResponse,
} from '../../types/whatsapp.types.js';

type SendPayload =
  | SendTextMessagePayload
  | SendImageMessagePayload
  | SendDocumentMessagePayload
  | SendInteractiveMessagePayload;

export class WhatsAppClient {
  private readonly baseUrl: string;

  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string
  ) {
    this.baseUrl = `${WHATSAPP_API_BASE_URL}/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  }

  private async send(payload: SendPayload): Promise<WhatsAppApiSendResponse> {
    const log = logger.child({ service: 'WhatsAppClient', to: (payload as { to: string }).to });

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Authorization header is never logged
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = null;
        }
        log.warn('WhatsApp API error response', { status: response.status });
        throw new WhatsAppApiError(
          `WhatsApp API returned ${response.status}`,
          response.status
        );
      }

      const data = (await response.json()) as WhatsAppApiSendResponse;
      log.info('WhatsApp message sent', { messageId: data.messages?.[0]?.id });
      return data;
    } catch (err) {
      if (err instanceof WhatsAppApiError) throw err;
      const message = err instanceof Error ? err.message : 'WhatsApp API request failed';
      throw new WhatsAppApiError(message);
    }
  }

  // ============================================================
  // sendTextMessage — FULLY IMPLEMENTED (V1 requirement)
  // ============================================================

  async sendTextMessage(to: string, text: string): Promise<WhatsAppApiSendResponse> {
    if (!text || text.trim().length === 0) {
      throw new WhatsAppApiError('Cannot send empty text message');
    }

    // WhatsApp has a 4096 character limit for text messages
    const body = text.length > 4096 ? text.substring(0, 4090) + '...' : text;

    const payload: SendTextMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body },
    };

    return this.send(payload);
  }

  // ============================================================
  // sendImageMessage — Prepared for Phase 6
  // ============================================================

  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string
  ): Promise<WhatsAppApiSendResponse> {
    const payload: SendImageMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    };
    return this.send(payload);
  }

  // ============================================================
  // sendDocumentMessage — Prepared for Phase 6
  // ============================================================

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    caption?: string,
    filename?: string
  ): Promise<WhatsAppApiSendResponse> {
    const payload: SendDocumentMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: { link: documentUrl, caption, filename },
    };
    return this.send(payload);
  }

  // ============================================================
  // sendInteractiveMessage — Prepared for Phase 2
  // ============================================================

  async sendInteractiveMessage(
    to: string,
    interactivePayload: SendInteractiveMessagePayload['interactive']
  ): Promise<WhatsAppApiSendResponse> {
    const payload: SendInteractiveMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: interactivePayload,
    };
    return this.send(payload);
  }
}

// ============================================================
// Factory function
// ============================================================

let _waClient: WhatsAppClient | null = null;

export function getWhatsAppClient(): WhatsAppClient {
  if (!_waClient) {
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new ConfigurationError(
        'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured'
      );
    }
    _waClient = new WhatsAppClient(env.WHATSAPP_ACCESS_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID);
  }
  return _waClient;
}

export function isWhatsAppAvailable(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}
