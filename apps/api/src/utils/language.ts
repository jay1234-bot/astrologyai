/**
 * Language utility functions
 * Deterministic language detection from explicit user commands
 *
 * Priority: explicit command > pattern detection > user preference > default
 */

import type { SupportedLanguage } from '../config/constants.js';
import { SUPPORTED_LANGUAGES } from '../config/constants.js';

// ============================================================
// Explicit language command patterns
// ============================================================

const HINDI_PATTERNS = [
  /\bhindi\b/i,
  /\bhindi\s+mein\b/i,
  /\bhindi\s+me\b/i,
  /हिंदी/,
  /हिन्दी/,
  /हिंदी\s+में/,
  /हिन्दी\s+में/,
  /\bspeak\s+hindi\b/i,
  /\bchange\s+to\s+hindi\b/i,
  /\bswitch\s+to\s+hindi\b/i,
  /\bhindu\s+language\b/i,
];

const ENGLISH_PATTERNS = [
  /\benglish\s+please\b/i,
  /\bspeak\s+english\b/i,
  /\bchange\s+to\s+english\b/i,
  /\bswitch\s+to\s+english\b/i,
  /\bin\s+english\b/i,
  /\buse\s+english\b/i,
  /\breply\s+in\s+english\b/i,
  /\bonly\s+english\b/i,
];

const MARATHI_PATTERNS = [
  /\bmarathi\b/i,
  /\bmarathit\b/i,
  /मराठी/,
  /मराठीत/,
  /\bspeak\s+marathi\b/i,
  /\bchange\s+to\s+marathi\b/i,
  /\bswitch\s+to\s+marathi\b/i,
  /\bmarathi\s+madhe\b/i,
  /मराठीत\s+बोला/,
];

// ============================================================
// Script detection patterns (for automatic inference)
// ============================================================

// Devanagari Unicode range: \u0900–\u097F
// We check if message contains Devanagari characters as a strong signal
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;

// Marathi-specific characters / common Marathi words
// Note: Both Hindi and Marathi use Devanagari; Marathi has some unique characters
const MARATHI_SPECIFIC_WORDS = [
  'आहे',
  'नाही',
  'काय',
  'कसे',
  'मला',
  'तुम्ही',
  'आपण',
  'करा',
  'सांगा',
  'माझे',
];
const HINDI_SPECIFIC_WORDS = [
  'है',
  'हैं',
  'नहीं',
  'क्या',
  'कैसे',
  'मुझे',
  'आप',
  'करो',
  'बताओ',
  'मेरा',
  'जी',
  'जानकारी',
];

// ============================================================
// Public API
// ============================================================

/**
 * Detect if the user is explicitly requesting a language change.
 * Returns the detected language code or null if no explicit command found.
 *
 * This is deterministic — does NOT call Gemini.
 */
export function detectExplicitLanguageCommand(text: string): SupportedLanguage | null {
  if (HINDI_PATTERNS.some((p) => p.test(text))) return 'hi';
  if (MARATHI_PATTERNS.some((p) => p.test(text))) return 'mr';
  if (ENGLISH_PATTERNS.some((p) => p.test(text))) return 'en';
  return null;
}

/**
 * Infer the probable language of a message from its content.
 * Uses conservative heuristics — only infers when confident.
 * Falls back to provided default.
 *
 * Does NOT override explicit user preference.
 */
export function inferLanguageFromContent(
  text: string,
  currentPreference: SupportedLanguage = 'en'
): SupportedLanguage {
  // If no Devanagari characters, likely English
  if (!DEVANAGARI_PATTERN.test(text)) {
    return 'en';
  }

  // Has Devanagari — try to distinguish Hindi vs Marathi
  const marathiScore = MARATHI_SPECIFIC_WORDS.filter((w) => text.includes(w)).length;
  const hindiScore = HINDI_SPECIFIC_WORDS.filter((w) => text.includes(w)).length;

  if (marathiScore > hindiScore && marathiScore > 0) return 'mr';
  if (hindiScore > marathiScore && hindiScore > 0) return 'hi';

  // Devanagari but can't distinguish — keep current preference if it's Indic
  if (currentPreference === 'hi' || currentPreference === 'mr') {
    return currentPreference;
  }

  // Default to Hindi for unclassified Devanagari
  return 'hi';
}

/**
 * Validate a language code is supported
 */
export function isValidLanguage(code: string): code is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(code as SupportedLanguage);
}

/**
 * Get the language name for display
 */
export function getLanguageName(code: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    en: 'English',
    hi: 'हिंदी',
    mr: 'मराठी',
  };
  return names[code];
}
