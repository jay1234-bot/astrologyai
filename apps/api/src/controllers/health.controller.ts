/**
 * Health Controller
 * GET /health and GET /api/status
 */

import type { Context } from 'hono';
import { env, isGeminiConfigured, isWhatsAppConfigured } from '../config/env.js';
import { getD1Client, isD1Available } from '../clients/d1-api.client.js';

export const healthController = {
  async health(c: Context) {
    return c.json({
      status: 'ok',
      service: 'pandit-harinath-ai',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  },

  async status(c: Context) {
    // Check D1 availability without exposing secrets
    let d1Status = 'not_configured';
    if (isD1Available()) {
      try {
        const client = getD1Client();
        const healthy = await client.health();
        d1Status = healthy ? 'connected' : 'unreachable';
      } catch {
        d1Status = 'error';
      }
    }

    return c.json({
      service: 'pandit-harinath-ai',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      status: {
        api: 'ok',
        ai: isGeminiConfigured ? 'configured' : 'not_configured',
        whatsapp: isWhatsAppConfigured ? 'configured' : 'not_configured',
        database: d1Status,
      },
      // Never expose actual secret values
      configuration: {
        ai_enabled: env.AI_ENABLED,
        default_language: env.DEFAULT_LANGUAGE,
        context_message_limit: env.AI_CONTEXT_MESSAGE_LIMIT,
        gemini_model: env.GEMINI_MODEL,
      },
    });
  },
};
