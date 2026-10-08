/**
 * Application-wide constants
 * Centralizes magic values and configuration defaults
 */

// ============================================================
// WhatsApp Cloud API
// ============================================================

export const WHATSAPP_API_VERSION = 'v21.0';
export const WHATSAPP_API_BASE_URL = 'https://graph.facebook.com';

// ============================================================
// Language support
// ============================================================

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  mr: 'मराठी (Marathi)',
};

// ============================================================
// AI
// ============================================================

export const MAX_CONTEXT_MESSAGES = 50; // Hard cap, configurable below this
export const MIN_CONTEXT_MESSAGES = 1;
export const DEFAULT_CONTEXT_MESSAGES = 15;

export const GEMINI_MAX_OUTPUT_TOKENS = 1024;
export const GEMINI_TEMPERATURE = 0.7;

// ============================================================
// Knowledge base
// ============================================================

export const KNOWLEDGE_CATEGORIES = [
  'astrology',
  'vastu',
  'pooja',
  'marriage',
  'general',
  'services',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = 5;

// ============================================================
// Business identity
// ============================================================

export const BUSINESS_NAME = 'पंडित हरिनाथ शास्त्री';
export const BUSINESS_NAME_EN = 'Pandit Harinath Shastri';
export const ASSISTANT_IDENTITY = `Official AI Assistant for ${BUSINESS_NAME}`;

// ============================================================
// Rate limiting
// ============================================================

export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;

// ============================================================
// Webhook processing
// ============================================================

export const WEBHOOK_ENTRY_FIELD = 'messages';
export const SUPPORTED_MESSAGE_TYPES = [
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'interactive',
  'button',
  'sticker',
  'reaction',
  'contacts',
] as const;

// ============================================================
// HTTP timeouts (ms)
// ============================================================

export const D1_API_TIMEOUT_MS = 10_000;
export const GEMINI_TIMEOUT_MS = 30_000;
export const WHATSAPP_API_TIMEOUT_MS = 10_000;
