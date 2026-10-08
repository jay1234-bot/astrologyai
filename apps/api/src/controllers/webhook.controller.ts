/**
 * Webhook Controller
 *
 * Implements the full 17-step message processing flow:
 * 1. Receive webhook
 * 2. Verify signature (done in middleware)
 * 3. Parse payload
 * 4. Extract WhatsApp user ID
 * 5. Extract message ID
 * 6. Deduplicate
 * 7. Get or create user
 * 8. Get or create conversation
 * 9. Store incoming message
 * 10. Determine language
 * 11. Retrieve recent conversation
 * 12. Search relevant knowledge
 * 13. Build Gemini prompt
 * 14. Call Gemini
 * 15. Validate AI response
 * 16. Send response through WhatsApp Cloud API
 * 17. Store outgoing response
 *
 * IMPORTANT: Meta receives HTTP 200 quickly.
 * All AI processing happens in a background task via Promise (fire-and-continue).
 */

import type { Context } from 'hono';
import { WhatsAppWebhookPayloadSchema, WebhookVerificationQuerySchema } from '../schemas/webhook.schema.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getD1Client, isD1Available } from '../clients/d1-api.client.js';
import { getWhatsAppClient, isWhatsAppAvailable } from '../services/whatsapp/whatsapp.client.js';
import { getAiService } from '../services/ai/ai.service.js';
import { getLanguageService } from '../services/language/language.service.js';
import { getKnowledgeService } from '../services/knowledge/knowledge.service.js';
import { getConversationService } from '../services/conversation/conversation.service.js';
import { getMessageService } from '../services/conversation/message.service.js';
import { LANGUAGE_CHANGE_MESSAGES } from '../prompts/system.prompt.js';
import { prepareResponseForWhatsApp } from '../services/ai/response.service.js';
import type { SupportedLanguage } from '../config/constants.js';
import type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppContact,
  ParsedIncomingMessage,
} from '../types/whatsapp.types.js';

// ============================================================
// In-memory rate limiter (per user)
// For production, this could be replaced with a Redis or D1-backed limiter
// ============================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS,
    });
    return true; // allowed
  }

  if (entry.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    return false; // rate limited
  }

  entry.count += 1;
  return true;
}

// Clean up old entries periodically to prevent memory leak
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000 // every 5 minutes
);

// ============================================================
// Controllers
// ============================================================

export const webhookController = {
  /**
   * GET /webhook — Meta verification handshake
   */
  verify(c: Context) {
    const query = c.req.query();

    const result = WebhookVerificationQuerySchema.safeParse(query);

    if (!result.success) {
      logger.warn('Webhook verification: invalid query params', { query });
      return c.text('Bad Request', 400);
    }

    const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } =
      result.data;

    if (!env.WHATSAPP_VERIFY_TOKEN) {
      logger.error('WHATSAPP_VERIFY_TOKEN not configured');
      return c.text('Forbidden', 403);
    }

    if (mode === 'subscribe' && verifyToken === env.WHATSAPP_VERIFY_TOKEN) {
      logger.info('Webhook verification successful');
      return c.text(challenge, 200);
    }

    logger.warn('Webhook verification failed: invalid token or mode', { mode });
    return c.text('Forbidden', 403);
  },

  /**
   * POST /webhook — Incoming WhatsApp messages
   *
   * Always returns 200 quickly to Meta.
   * Processing happens in background.
   */
  async receive(c: Context) {
    // Get raw body stored by middleware
    const rawBody = c.get('rawBody') as string | undefined;

    let payload: WhatsAppWebhookPayload;
    try {
      const body = rawBody ? JSON.parse(rawBody) : await c.req.json();
      const parsed = WhatsAppWebhookPayloadSchema.safeParse(body);

      if (!parsed.success) {
        logger.warn('Webhook: invalid payload structure', {
          errors: parsed.error.flatten().fieldErrors,
        });
        // Still return 200 to Meta to prevent retries for malformed payloads
        return c.json({ status: 'received' }, 200);
      }

      payload = parsed.data as WhatsAppWebhookPayload;
    } catch (err) {
      logger.warn('Webhook: failed to parse body', {
        error: err instanceof Error ? err.message : 'unknown',
      });
      return c.json({ status: 'received' }, 200);
    }

    // Fire background processing and return 200 immediately to Meta
    processWebhookBackground(payload).catch((err) => {
      logger.error('Background webhook processing failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    });

    return c.json({ status: 'received' }, 200);
  },
};

// ============================================================
// Background processing
// ============================================================

async function processWebhookBackground(payload: WhatsAppWebhookPayload): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const { messages, contacts, statuses } = change.value;

      // Process status updates (delivery receipts, etc.)
      if (statuses && statuses.length > 0) {
        for (const status of statuses) {
          logger.info('Message status update', {
            messageId: status.id,
            status: status.status,
          });
        }
      }

      // Process incoming messages
      if (messages && messages.length > 0) {
        for (const message of messages) {
          const contactMap = buildContactMap(contacts ?? []);
          await processIncomingMessage(message, contactMap).catch((err) => {
            logger.error('Failed to process individual message', {
              messageId: message.id,
              error: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
      }
    }
  }
}

function buildContactMap(contacts: WhatsAppContact[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const contact of contacts) {
    map.set(contact.wa_id, contact.profile.name);
  }
  return map;
}

/**
 * Parse a raw WhatsApp message into a normalized structure
 */
function parseMessage(
  message: WhatsAppMessage,
  displayName: string
): ParsedIncomingMessage {
  return {
    messageId: message.id,
    from: message.from,
    displayName,
    timestamp: new Date(parseInt(message.timestamp) * 1000),
    type: message.type as ParsedIncomingMessage['type'],
    text: message.text?.body,
    mediaId:
      message.image?.id ??
      message.audio?.id ??
      message.video?.id ??
      message.document?.id ??
      message.sticker?.id,
    mediaCaption:
      message.image?.caption ??
      message.video?.caption ??
      message.document?.caption,
    locationData: message.location,
    interactiveData: message.interactive,
    buttonData: message.button,
    rawMessage: message,
  };
}

/**
 * Process a single incoming message through the complete 17-step flow
 */
async function processIncomingMessage(
  rawMessage: WhatsAppMessage,
  contactMap: Map<string, string>
): Promise<void> {
  const displayName = contactMap.get(rawMessage.from) ?? rawMessage.from;
  const parsed = parseMessage(rawMessage, displayName);

  const log = logger.child({
    messageId: parsed.messageId,
    from: parsed.from,
    type: parsed.type,
  });

  log.info('Processing incoming message', { type: parsed.type });

  // ── AI_ENABLED Check ──
  // If the system is disabled, we abort immediately so NO messages are sent out.
  if (!env.AI_ENABLED) {
    log.info('System is disabled (AI_ENABLED=false) — ignoring message completely');
    return;
  }

  // ── Step 6: Deduplication ──
  if (isD1Available()) {
    try {
      const client = getD1Client();
      const alreadyProcessed = await client.checkWebhookProcessed(parsed.messageId);
      if (alreadyProcessed) {
        log.info('Duplicate message detected — skipping');
        return;
      }
      // Mark as processed immediately to prevent race conditions
      await client.markWebhookProcessed(parsed.messageId, parsed.type);
    } catch (err) {
      log.warn('Deduplication check failed — proceeding anyway', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // ── Step 7: Get or create user ──
  let user = null;
  let preferredLanguage: SupportedLanguage = env.DEFAULT_LANGUAGE as SupportedLanguage;

  if (isD1Available()) {
    try {
      const client = getD1Client();
      user = await client.getOrCreateUser({
        whatsapp_user_id: parsed.from,
        phone_number: parsed.from,
        display_name: parsed.displayName,
      });
      preferredLanguage = (user.preferred_language as SupportedLanguage) ?? preferredLanguage;
      log.debug('User resolved', { userId: user.id, language: preferredLanguage });
    } catch (err) {
      log.warn('Failed to get/create user', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // ── Step 8: Get or create conversation ──
  let conversation = null;
  if (user && isD1Available()) {
    try {
      const convService = getConversationService();
      conversation = await convService.getOrCreateConversation(user.id);
    } catch (err) {
      log.warn('Failed to get/create conversation', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // For non-text messages: store metadata and send graceful acknowledgment
  if (parsed.type !== 'text') {
    await handleNonTextMessage(parsed, conversation?.id, preferredLanguage, log);
    return;
  }

  if (!parsed.text) {
    log.warn('Text message with empty body');
    return;
  }

  // ── Step 9: Store incoming message ──
  if (conversation) {
    const msgService = getMessageService();
    await msgService.storeInbound({
      conversationId: conversation.id,
      whatsappMessageId: parsed.messageId,
      messageType: 'text',
      content: parsed.text,
      language: preferredLanguage,
    });
  }

  // ── Step 10: Determine language ──
  const languageService = getLanguageService();
  const { language, changed: languageChanged } = languageService.detectAndResolve({
    messageText: parsed.text,
    currentPreference: preferredLanguage,
  });

  // If user explicitly changed language, persist and acknowledge
  if (languageChanged && user) {
    await languageService.persistLanguagePreference(parsed.from, language);

    // Send language change acknowledgment
    const ackMessage = LANGUAGE_CHANGE_MESSAGES[language];
    await sendWhatsAppResponse(parsed.from, ackMessage, log);

    // Store outbound ack
    if (conversation) {
      const msgService = getMessageService();
      await msgService.storeOutbound({
        conversationId: conversation.id,
        content: ackMessage,
        language,
        aiGenerated: false,
      });
    }
    return;
  }

  // ── Rate limiting ──
  if (!checkRateLimit(parsed.from)) {
    log.warn('Rate limit exceeded');
    const rateLimitMsg = {
      en: 'You\'re sending messages too quickly. Please wait a moment before trying again.',
      hi: 'आप बहुत तेज़ी से संदेश भेज रहे हैं। कृपया फिर से प्रयास करने से पहले एक क्षण प्रतीक्षा करें।',
      mr: 'तुम्ही खूप जलद संदेश पाठवत आहात. कृपया पुन्हा प्रयत्न करण्यापूर्वी थोडा वेळ थांबा.',
    };
    await sendWhatsAppResponse(parsed.from, rateLimitMsg[language], log);
    return;
  }

  // ── Step 11: Retrieve recent conversation history ──
  let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (conversation) {
    const convService = getConversationService();
    conversationHistory = await convService.getConversationHistory(conversation.id);
  }

  // ── Step 12: Search relevant knowledge ──
  const knowledgeService = getKnowledgeService();
  const knowledgeDocs = await knowledgeService.searchKnowledge({
    query: parsed.text,
    language,
  });

  // ── Steps 13-15: Build prompt, call Gemini, validate response ──
  const aiService = getAiService();
  const aiResponse = await aiService.generateResponse({
    language,
    knowledgeDocuments: knowledgeDocs,
    conversationHistory,
    userMessage: parsed.text,
    displayName: parsed.displayName,
  });

  const responseText = prepareResponseForWhatsApp(aiResponse.text);

  // ── Step 16: Send WhatsApp response ──
  await sendWhatsAppResponse(parsed.from, responseText, log);

  // ── Step 17: Store outgoing response ──
  if (conversation) {
    const msgService = getMessageService();
    await msgService.storeOutbound({
      conversationId: conversation.id,
      content: responseText,
      language,
      aiGenerated: true,
    });
  }

  log.info('Message processing completed');
}

/**
 * Handle non-text message types gracefully
 */
async function handleNonTextMessage(
  parsed: ParsedIncomingMessage,
  conversationId: string | undefined,
  language: SupportedLanguage,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  log.info('Non-text message received', { type: parsed.type });

  // Store metadata if we have a conversation
  if (conversationId) {
    const msgService = getMessageService();
    await msgService.storeInbound({
      conversationId,
      whatsappMessageId: parsed.messageId,
      messageType: parsed.type,
      content: parsed.mediaCaption,
      language,
      metadata: {
        mediaId: parsed.mediaId,
        type: parsed.type,
      },
    });
  }

  // Send graceful acknowledgment for unsupported types
  const messages: Record<string, Record<SupportedLanguage, string>> = {
    image: {
      en: 'Thank you for sending an image. Currently, I can only process text messages. Please describe your query in text and I\'ll be happy to help!',
      hi: 'छवि भेजने के लिए धन्यवाद। वर्तमान में, मैं केवल टेक्स्ट संदेशों को प्रोसेस कर सकता हूँ। कृपया अपना प्रश्न टेक्स्ट में लिखें और मैं आपकी सहायता करूंगा!',
      mr: 'फोटो पाठवल्याबद्दल धन्यवाद. सध्या, मी फक्त मजकूर संदेश प्रक्रिया करू शकतो. कृपया तुमची विनंती मजकूरात लिहा आणि मी मदत करीन!',
    },
    audio: {
      en: 'Thank you for your voice message. Currently, I can only process text messages. Please type your query and I\'ll be happy to assist!',
      hi: 'आपके वॉइस संदेश के लिए धन्यवाद। वर्तमान में, मैं केवल टेक्स्ट संदेशों को प्रोसेस कर सकता हूँ। कृपया अपना प्रश्न टाइप करें और मैं आपकी सहायता करूंगा!',
      mr: 'व्हॉइस मेसेजसाठी धन्यवाद. सध्या, मी फक्त मजकूर संदेश प्रक्रिया करू शकतो. कृपया तुमची विनंती टाइप करा आणि मी मदत करीन!',
    },
    default: {
      en: 'Thank you for your message. I\'m best able to help with text messages. Please type your query about our services.',
      hi: 'आपके संदेश के लिए धन्यवाद। मैं टेक्स्ट संदेशों के साथ सबसे अच्छी मदद कर सकता हूँ। कृपया हमारी सेवाओं के बारे में अपना प्रश्न टाइप करें।',
      mr: 'तुमच्या संदेशासाठी धन्यवाद. मी मजकूर संदेशांसह सर्वोत्तम मदत करू शकतो. कृपया आमच्या सेवांबद्दल तुमची विनंती टाइप करा.',
    },
  };

  const typeMessages = messages[parsed.type] ?? messages['default']!;
  const ackMessage = typeMessages[language] ?? typeMessages['en']!;

  await sendWhatsAppResponse(parsed.from, ackMessage, log);
}

/**
 * Send a WhatsApp text message — handles missing configuration gracefully
 */
async function sendWhatsAppResponse(
  to: string,
  text: string,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  if (!isWhatsAppAvailable()) {
    log.warn('WhatsApp not configured — would have sent message', {
      to,
      textLength: text.length,
    });
    return;
  }

  try {
    const client = getWhatsAppClient();
    await client.sendTextMessage(to, text);
    log.info('WhatsApp message sent', { to, textLength: text.length });
  } catch (err) {
    log.error('Failed to send WhatsApp message', {
      to,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
