/**
 * Server entry point
 *
 * Starts the Hono app on @hono/node-server.
 * Listens on 0.0.0.0 for Render compatibility.
 * PORT from environment variable.
 */

import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { isGeminiConfigured, isWhatsAppConfigured, isD1Configured } from './config/env.js';

const port = env.PORT;

logger.info('Starting पंडित हरिनाथ शास्त्री AI Backend', {
  port,
  environment: env.NODE_ENV,
  gemini: isGeminiConfigured ? 'configured' : 'not configured (AI disabled)',
  whatsapp: isWhatsAppConfigured ? 'configured' : 'not configured (WhatsApp disabled)',
  d1: isD1Configured ? 'configured' : 'not configured (DB disabled)',
});

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0', // Required for Render
  },
  (info) => {
    logger.info(`Server listening`, {
      url: `http://localhost:${info.port}`,
      health: `http://localhost:${info.port}/health`,
      webhook: `http://localhost:${info.port}/webhook`,
    });

    if (!isGeminiConfigured) {
      logger.warn('⚠  GEMINI_API_KEY not set — AI responses will use fallback messages');
    }
    if (!isWhatsAppConfigured) {
      logger.warn('⚠  WhatsApp credentials not set — messages will not be sent/received');
    }
    if (!isD1Configured) {
      logger.warn('⚠  D1 credentials not set — running without persistent storage');
    }
  }
);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  process.exit(0);
});

// Unhandled rejections — log but don't crash
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});
