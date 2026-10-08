/**
 * AI Service — Orchestration layer
 *
 * Coordinates between:
 * - GeminiService (LLM calls)
 * - PromptService (prompt assembly)
 * - Knowledge retrieval
 * - Conversation history
 *
 * This is the single entry point for all AI response generation.
 * Controllers should call this service, not Gemini directly.
 */

import { getGeminiService } from './gemini.service.js';
import { buildPrompt } from './prompt.service.js';
import { CUSTOMER_FALLBACK_MESSAGES } from '../../prompts/system.prompt.js';
import { ConfigurationError, GeminiError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { PromptContext, AiResponse } from '../../types/ai.types.js';

export class AiService {
  private readonly gemini = getGeminiService();

  get isAvailable(): boolean {
    return this.gemini.isAvailable;
  }

  /**
   * Generate an AI response for a user message.
   * Returns a safe fallback message if AI is unavailable or fails.
   *
   * This NEVER throws to the caller — it always returns a string response.
   */
  async generateResponse(context: PromptContext): Promise<AiResponse> {
    const log = logger.child({ service: 'AiService' });

    if (!this.isAvailable) {
      log.warn('AI service not available, returning fallback message');
      return {
        text: CUSTOMER_FALLBACK_MESSAGES[context.language],
        language: context.language,
      };
    }

    try {
      const { systemInstruction, conversationHistory, userMessage } = buildPrompt(context);

      const text = await this.gemini.generateResponse({
        systemInstruction,
        history: conversationHistory,
        userMessage,
      });

      // Validate the response
      const validatedText = validateAndCleanResponse(text);

      return {
        text: validatedText,
        language: context.language,
      };
    } catch (err) {
      if (err instanceof ConfigurationError) {
        log.warn('AI configuration error', { error: err.message });
        return {
          text: CUSTOMER_FALLBACK_MESSAGES[context.language],
          language: context.language,
        };
      }

      if (err instanceof GeminiError) {
        log.error('Gemini API error', { error: err.message });
        return {
          text: CUSTOMER_FALLBACK_MESSAGES[context.language],
          language: context.language,
        };
      }

      // Unknown error — safe fallback
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error('AI service unexpected error', { error: message });
      return {
        text: CUSTOMER_FALLBACK_MESSAGES[context.language],
        language: context.language,
      };
    }
  }
}

// ============================================================
// Response validation
// ============================================================

/**
 * Validate and clean the AI response before sending to customer.
 * Checks for potential prompt leakage patterns.
 */
function validateAndCleanResponse(text: string): string {
  const cleaned = text.trim();

  // Check for potential system prompt leakage (basic detection)
  const suspiciousPatterns = [
    /GEMINI_API_KEY/i,
    /WHATSAPP_ACCESS_TOKEN/i,
    /META_APP_SECRET/i,
    /D1_API_SECRET/i,
    /ADMIN_API_KEY/i,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /## ABSOLUTE RULES/i,
    /## LANGUAGE RULE/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(cleaned)) {
      logger.warn('AI response contains potentially sensitive content — using fallback', {
        pattern: pattern.toString(),
      });
      return "I'm sorry, I encountered an issue generating a response. Please try again.";
    }
  }

  return cleaned;
}

// ============================================================
// Singleton
// ============================================================

let _aiService: AiService | null = null;

export function getAiService(): AiService {
  if (!_aiService) {
    _aiService = new AiService();
  }
  return _aiService;
}
