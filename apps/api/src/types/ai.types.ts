/**
 * AI service type definitions
 */

import type { SupportedLanguage } from '../config/constants.js';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  content: string;
  language: string;
}

export interface PromptContext {
  language: SupportedLanguage;
  knowledgeDocuments: KnowledgeDocument[];
  conversationHistory: ConversationMessage[];
  userMessage: string;
  displayName?: string;
}

export interface AiResponse {
  text: string;
  language: SupportedLanguage;
  tokensUsed?: number;
}

export interface GeminiGenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
}
