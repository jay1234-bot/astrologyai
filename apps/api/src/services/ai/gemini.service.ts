/**
 * Gemini AI Service
 *
 * Direct integration with Google Gemini via the official @google/genai SDK.
 * Model and API key come from environment — never hardcoded.
 *
 * Server starts in development even when GEMINI_API_KEY is missing.
 * Missing key returns a controlled error, not a crash.
 */

import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { GEMINI_MAX_OUTPUT_TOKENS, GEMINI_TEMPERATURE } from '../../config/constants.js';
import { GeminiError, ConfigurationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { GeminiGenerateOptions } from '../../types/ai.types.js';

export class GeminiService {
  private client: GoogleGenAI | null = null;
  private readonly model: string;

  constructor() {
    this.model = env.GEMINI_MODEL;

    // Initialize client only if API key is available
    if (env.GEMINI_API_KEY) {
      try {
        this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        logger.info('Gemini service initialized', { model: this.model });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gemini init failed';
        logger.warn('Gemini service failed to initialize', { error: message });
        this.client = null;
      }
    } else {
      logger.warn('Gemini service: GEMINI_API_KEY not configured. AI responses disabled.');
    }
  }

  get isAvailable(): boolean {
    return this.client !== null && Boolean(env.GEMINI_API_KEY) && env.AI_ENABLED;
  }

  /**
   * Generate a response from Gemini using multi-turn conversation history.
   *
   * @param systemInstruction - The complete system prompt
   * @param history - Prior conversation turns in Gemini format
   * @param userMessage - The current user message
   * @param options - Optional generation config overrides
   */
  async generateResponse(params: {
    systemInstruction: string;
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    userMessage: string;
    options?: GeminiGenerateOptions;
  }): Promise<string> {
    if (!this.isAvailable || !this.client) {
      throw new ConfigurationError('AI service is not configured or is disabled');
    }

    const log = logger.child({ service: 'GeminiService', model: this.model });

    log.info('Gemini request starting', {
      historyLength: params.history.length,
      userMessageLength: params.userMessage.length,
    });

    try {
      const startTime = Date.now();

      // Create a chat session with history
      const chat = this.client.chats.create({
        model: this.model,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.options?.temperature ?? GEMINI_TEMPERATURE,
          maxOutputTokens: params.options?.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS,
        },
        history: params.history,
      });

      // Send the current user message
      const response = await chat.sendMessage({
        message: params.userMessage,
      });

      const durationMs = Date.now() - startTime;
      const text = response.text ?? '';

      log.info('Gemini request completed', {
        durationMs,
        responseLength: text.length,
      });

      if (!text || text.trim().length === 0) {
        throw new GeminiError('Gemini returned an empty response');
      }

      return text;
    } catch (err) {
      if (err instanceof GeminiError || err instanceof ConfigurationError) throw err;

      const message = err instanceof Error ? err.message : 'Unknown Gemini error';
      log.error('Gemini request failed', { error: message });
      throw new GeminiError(`Gemini API error: ${message}`);
    }
  }
}

// ============================================================
// Singleton
// ============================================================

let _geminiService: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!_geminiService) {
    _geminiService = new GeminiService();
  }
  return _geminiService;
}
