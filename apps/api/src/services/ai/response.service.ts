/**
 * Response Service
 * Validates, formats, and sanitizes AI responses before delivery
 */

import { formatForWhatsApp } from '../whatsapp/whatsapp.messages.js';

/**
 * Prepare an AI response text for sending via WhatsApp
 */
export function prepareResponseForWhatsApp(text: string): string {
  return formatForWhatsApp(text);
}

/**
 * Check if a response text appears to be a valid, non-empty response
 */
export function isValidResponse(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length < 4096;
}
