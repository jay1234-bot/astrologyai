/**
 * Language Service
 *
 * Handles language detection and user language preference management.
 * Uses deterministic rules first, infers from content second.
 * User explicit preference always wins.
 */

import {
  detectExplicitLanguageCommand,
  inferLanguageFromContent,
  isValidLanguage,
} from '../../utils/language.js';
import { logger } from '../../utils/logger.js';
import { getD1Client, isD1Available } from '../../clients/d1-api.client.js';
import type { SupportedLanguage } from '../../config/constants.js';
import { env } from '../../config/env.js';

export class LanguageService {
  /**
   * Determine the language to use for responding to a message.
   *
   * Priority:
   * 1. Explicit language command from the user (highest)
   * 2. User's stored preference
   * 3. Inferred from message content
   * 4. System default (lowest)
   *
   * @returns { language, changed } — the language to use and whether it changed
   */
  detectAndResolve(params: {
    messageText: string;
    currentPreference: SupportedLanguage;
  }): { language: SupportedLanguage; changed: boolean } {
    const { messageText, currentPreference } = params;

    // Step 1: Check for explicit language command
    const explicitCommand = detectExplicitLanguageCommand(messageText);
    if (explicitCommand) {
      const changed = explicitCommand !== currentPreference;
      logger.debug('Explicit language command detected', {
        command: explicitCommand,
        previous: currentPreference,
        changed,
      });
      return { language: explicitCommand, changed };
    }

    // Step 2: User's stored preference is used as-is
    // (No auto-switching based on message content unless explicit)
    // This prevents frustrating mid-conversation language switching

    // Step 3: If user has no preference (default), infer from content
    const defaultLang = env.DEFAULT_LANGUAGE as SupportedLanguage;
    if (currentPreference === defaultLang) {
      const inferred = inferLanguageFromContent(messageText, currentPreference);
      if (inferred !== currentPreference) {
        // Inferred a non-default language — but don't persist this automatically
        // Only persist if explicit command detected
        return { language: inferred, changed: false };
      }
    }

    return { language: currentPreference, changed: false };
  }

  /**
   * Persist the user's language preference to the database.
   * Only called when the user explicitly changes language.
   */
  async persistLanguagePreference(
    whatsappUserId: string,
    language: SupportedLanguage
  ): Promise<void> {
    if (!isD1Available()) {
      logger.warn('D1 not available, cannot persist language preference');
      return;
    }

    try {
      const client = getD1Client();
      await client.updateUserLanguage(whatsappUserId, language);
      logger.info('Language preference updated', { language });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to persist language preference', { error: message });
      // Non-fatal — continue without persisting
    }
  }

  /**
   * Validate and normalize a language code
   */
  normalize(code: string): SupportedLanguage {
    const defaultLang = env.DEFAULT_LANGUAGE as SupportedLanguage;
    return isValidLanguage(code) ? (code as SupportedLanguage) : defaultLang;
  }
}

// Singleton
let _languageService: LanguageService | null = null;

export function getLanguageService(): LanguageService {
  if (!_languageService) {
    _languageService = new LanguageService();
  }
  return _languageService;
}
