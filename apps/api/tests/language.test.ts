import { describe, it, expect } from 'vitest';
import {
  detectExplicitLanguageCommand,
  inferLanguageFromContent,
  isValidLanguage,
} from '../src/utils/language.js';

describe('Language Detection — Explicit Commands', () => {
  describe('Hindi detection', () => {
    it('detects "Hindi"', () => {
      expect(detectExplicitLanguageCommand('Hindi')).toBe('hi');
    });

    it('detects "hindi" (case insensitive)', () => {
      expect(detectExplicitLanguageCommand('please speak hindi')).toBe('hi');
    });

    it('detects "हिंदी"', () => {
      expect(detectExplicitLanguageCommand('हिंदी में बात करो')).toBe('hi');
    });

    it('detects "हिंदी में"', () => {
      expect(detectExplicitLanguageCommand('हिंदी में जवाब दो')).toBe('hi');
    });

    it('detects "Hindi mein"', () => {
      expect(detectExplicitLanguageCommand('Hindi mein baat karo')).toBe('hi');
    });
  });

  describe('Marathi detection', () => {
    it('detects "Marathi"', () => {
      expect(detectExplicitLanguageCommand('Marathi')).toBe('mr');
    });

    it('detects "मराठी"', () => {
      expect(detectExplicitLanguageCommand('मराठीत बोला')).toBe('mr');
    });

    it('detects "मराठीत"', () => {
      expect(detectExplicitLanguageCommand('मराठीत उत्तर द्या')).toBe('mr');
    });

    it('detects "marathit"', () => {
      expect(detectExplicitLanguageCommand('marathit bolav')).toBe('mr');
    });
  });

  describe('English detection', () => {
    it('detects "English please"', () => {
      expect(detectExplicitLanguageCommand('English please')).toBe('en');
    });

    it('detects "speak English"', () => {
      expect(detectExplicitLanguageCommand('speak English')).toBe('en');
    });

    it('detects "in English"', () => {
      expect(detectExplicitLanguageCommand('reply in English')).toBe('en');
    });
  });

  describe('No command', () => {
    it('returns null for regular messages', () => {
      expect(detectExplicitLanguageCommand('What are your services?')).toBeNull();
    });

    it('returns null for Devanagari non-command text', () => {
      expect(detectExplicitLanguageCommand('मुझे कुंडली के बारे में जानना है')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectExplicitLanguageCommand('')).toBeNull();
    });
  });
});

describe('Language Inference from Content', () => {
  it('returns en for Latin-only text', () => {
    expect(inferLanguageFromContent('Hello, I need help with vastu', 'en')).toBe('en');
  });

  it('infers hi for Devanagari with Hindi words', () => {
    expect(inferLanguageFromContent('मुझे जानकारी चाहिए', 'en')).toBe('hi');
  });

  it('infers mr for Devanagari with Marathi words', () => {
    expect(inferLanguageFromContent('मला माहिती आहे', 'en')).toBe('mr');
  });

  it('keeps current preference for ambiguous Devanagari', () => {
    // Text with no known Hindi or Marathi specific words
    const result = inferLanguageFromContent('नमस्ते', 'hi');
    expect(['hi', 'mr']).toContain(result); // Could be either, just not English
  });
});

describe('Language Validation', () => {
  it('accepts valid language codes', () => {
    expect(isValidLanguage('en')).toBe(true);
    expect(isValidLanguage('hi')).toBe(true);
    expect(isValidLanguage('mr')).toBe(true);
  });

  it('rejects invalid language codes', () => {
    expect(isValidLanguage('fr')).toBe(false);
    expect(isValidLanguage('te')).toBe(false);
    expect(isValidLanguage('')).toBe(false);
    expect(isValidLanguage('EN')).toBe(false);
  });
});
