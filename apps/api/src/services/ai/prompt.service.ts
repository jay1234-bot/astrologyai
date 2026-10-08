/**
 * Prompt Service
 *
 * Assembles the complete Gemini prompt from components:
 * SYSTEM INSTRUCTIONS + BUSINESS IDENTITY + LANGUAGE RULE +
 * RELEVANT KNOWLEDGE + RECENT CONVERSATION + CURRENT USER MESSAGE
 *
 * Never builds prompts directly in controllers or other services.
 */

import {
  CORE_SYSTEM_INSTRUCTIONS,
  LANGUAGE_INSTRUCTIONS,
} from '../../prompts/system.prompt.js';
import { BUSINESS_NAME } from '../../config/constants.js';
import type { PromptContext, ConversationMessage } from '../../types/ai.types.js';

// ============================================================
// Prompt assembly
// ============================================================

/**
 * Build the complete prompt for a Gemini API call.
 * Returns { systemInstruction, contents } matching Gemini SDK format.
 */
export function buildPrompt(context: PromptContext): {
  systemInstruction: string;
  conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  userMessage: string;
} {
  const systemInstruction = buildSystemInstruction(context);
  const conversationHistory = buildConversationHistory(context.conversationHistory);

  return {
    systemInstruction,
    conversationHistory,
    userMessage: context.userMessage,
  };
}

/**
 * Build the system instruction block
 */
function buildSystemInstruction(context: PromptContext): string {
  const parts: string[] = [];

  // Core system instructions
  parts.push(CORE_SYSTEM_INSTRUCTIONS.trim());

  // Language-specific instructions
  parts.push(LANGUAGE_INSTRUCTIONS[context.language].trim());

  // Knowledge context (if available)
  if (context.knowledgeDocuments.length > 0) {
    const knowledgeSection = buildKnowledgeSection(context);
    parts.push(knowledgeSection);
  }

  return parts.join('\n\n');
}

/**
 * Build the knowledge context section
 */
function buildKnowledgeSection(context: PromptContext): string {
  const docs = context.knowledgeDocuments
    .slice(0, 5) // Safety limit
    .map((doc) => `### ${doc.title} (${doc.category})\n${doc.content}`)
    .join('\n\n---\n\n');

  return `## RELEVANT BUSINESS KNOWLEDGE
The following information from ${BUSINESS_NAME}'s knowledge base is relevant to the current conversation.
Use ONLY this information when answering questions about services, processes, or details.
Do NOT invent additional details beyond what is written here.

${docs}

END OF KNOWLEDGE BASE`;
}

/**
 * Convert stored messages to Gemini conversation format
 * Gemini uses 'user' and 'model' roles (not 'assistant')
 */
function buildConversationHistory(
  messages: ConversationMessage[]
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  return messages.map((msg) => ({
    role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: msg.content }],
  }));
}

/**
 * Build a greeting prompt for new users
 */
export function buildGreetingContext(
  language: PromptContext['language'],
  displayName?: string
): PromptContext {
  const greetingMessage = displayName
    ? `Hello, my name is ${displayName}`
    : 'Hello';

  return {
    language,
    knowledgeDocuments: [],
    conversationHistory: [],
    userMessage: greetingMessage,
    displayName,
  };
}
