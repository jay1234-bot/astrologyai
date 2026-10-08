/**
 * WhatsApp message helpers
 * Utility functions for constructing and validating outgoing messages
 */

/**
 * Truncate a message to WhatsApp's text limit
 */
export function truncateText(text: string, maxLength = 4096): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format a text message for WhatsApp
 * WhatsApp supports basic markdown: *bold*, _italic_, ~strikethrough~, ```code```
 */
export function formatForWhatsApp(text: string): string {
  return truncateText(text.trim());
}

/**
 * Validate a WhatsApp phone number
 * Should be E.164 format without the + prefix (e.g., "919876543210")
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}
