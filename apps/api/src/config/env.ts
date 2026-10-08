/**
 * Environment configuration — SINGLE SOURCE OF TRUTH for all env vars
 *
 * Uses Zod for runtime validation.
 * Server starts in development even if optional keys are missing.
 * Missing required keys only throw in production mode.
 */

import { z } from 'zod';

// ============================================================
// Schema
// ============================================================

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  // WhatsApp Cloud API
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),

  // Cloudflare D1 API Worker
  D1_API_URL: z.string().url().optional(),
  D1_API_SECRET: z.string().optional(),

  // Admin
  ADMIN_API_KEY: z.string().optional(),

  // App behaviour
  DEFAULT_LANGUAGE: z.enum(['en', 'hi', 'mr']).default('en'),
  AI_ENABLED: z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .default('true'),

  // Conversation context
  AI_CONTEXT_MESSAGE_LIMIT: z.coerce.number().int().min(1).max(50).default(15),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

// ============================================================
// Parse and export
// ============================================================

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n');

    // In production, invalid config is fatal
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(`Environment configuration errors:\n${messages}`);
    }

    // In development, warn but continue
    console.warn(`[Config] Environment warnings:\n${messages}`);
    // Return with defaults for development
    return envSchema.parse({
      ...process.env,
      NODE_ENV: process.env['NODE_ENV'] ?? 'development',
    });
  }

  return result.data;
}

export const env = loadEnv();

// ============================================================
// Derived feature flags
// ============================================================

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.AI_ENABLED);
export const isWhatsAppConfigured = Boolean(
  env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_PHONE_NUMBER_ID &&
    env.WHATSAPP_VERIFY_TOKEN &&
    env.META_APP_SECRET
);
export const isD1Configured = Boolean(env.D1_API_URL && env.D1_API_SECRET);
export const isAdminConfigured = Boolean(env.ADMIN_API_KEY);
