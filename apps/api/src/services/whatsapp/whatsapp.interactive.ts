/**
 * WhatsApp Interactive Message Builder
 *
 * Prepared for Phase 2: WhatsApp Buttons, Lists, and CTA URLs
 *
 * DO NOT implement actual buttons yet.
 * This file provides the builder infrastructure so Phase 2
 * can add interactive messages without rewriting the core system.
 *
 * Future menu structure:
 *   🔮 Astrology
 *   🏠 Vastu Shastra
 *   🙏 Pooja Path
 *   💍 Marriage Services
 *   📅 Kundli
 *   📞 Contact Pandit Ji
 *   🌐 Change Language
 */

import type { InteractiveObject } from '../../types/whatsapp.types.js';

// ============================================================
// Phase 2 builders (not yet called from production code)
// ============================================================

/**
 * Build a reply button interactive message
 * Max 3 buttons per message
 */
export function buildReplyButtons(params: {
  bodyText: string;
  buttons: Array<{ id: string; title: string }>;
  headerText?: string;
  footerText?: string;
}): InteractiveObject {
  if (params.buttons.length > 3) {
    throw new Error('WhatsApp allows a maximum of 3 reply buttons');
  }

  return {
    type: 'button',
    ...(params.headerText && { header: { type: 'text', text: params.headerText } }),
    body: { text: params.bodyText },
    ...(params.footerText && { footer: { text: params.footerText } }),
    action: {
      buttons: params.buttons.map((btn) => ({
        type: 'reply' as const,
        reply: { id: btn.id, title: btn.title.substring(0, 20) }, // 20 char limit
      })),
    },
  };
}

/**
 * Build a list message interactive message
 * Used for service menus with more than 3 options
 */
export function buildListMessage(params: {
  bodyText: string;
  buttonLabel: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  headerText?: string;
  footerText?: string;
}): InteractiveObject {
  return {
    type: 'list',
    ...(params.headerText && { header: { type: 'text', text: params.headerText } }),
    body: { text: params.bodyText },
    ...(params.footerText && { footer: { text: params.footerText } }),
    action: {
      button: params.buttonLabel.substring(0, 20),
      sections: params.sections.map((section) => ({
        title: section.title,
        rows: section.rows.map((row) => ({
          id: row.id,
          title: row.title.substring(0, 24), // 24 char limit
          description: row.description?.substring(0, 72), // 72 char limit
        })),
      })),
    },
  };
}

// ============================================================
// Phase 2: Main service menu builder (not yet called)
// ============================================================

/**
 * Build the main service selection menu
 * Will be used in Phase 2
 */
export function buildServiceMenu(language: 'en' | 'hi' | 'mr'): InteractiveObject {
  const translations = {
    en: {
      body: 'How can I help you today? Please select a service:',
      button: 'Our Services',
      services: 'Services',
      astrology: '🔮 Astrology & Kundli',
      vastu: '🏠 Vastu Shastra',
      pooja: '🙏 Pooja & Path',
      marriage: '💍 Marriage Ceremonies',
      contact: '📞 Contact Pandit Ji',
      language: '🌐 Change Language',
    },
    hi: {
      body: 'आज मैं आपकी कैसे सहायता कर सकता हूँ? कृपया एक सेवा चुनें:',
      button: 'हमारी सेवाएं',
      services: 'सेवाएं',
      astrology: '🔮 ज्योतिष और कुंडली',
      vastu: '🏠 वास्तु शास्त्र',
      pooja: '🙏 पूजा और पाठ',
      marriage: '💍 विवाह संस्कार',
      contact: '📞 पंडित जी से संपर्क',
      language: '🌐 भाषा बदलें',
    },
    mr: {
      body: 'आज मी तुम्हाला कशी मदत करू शकतो? कृपया एक सेवा निवडा:',
      button: 'आमच्या सेवा',
      services: 'सेवा',
      astrology: '🔮 ज्योतिष आणि कुंडली',
      vastu: '🏠 वास्तू शास्त्र',
      pooja: '🙏 पूजा आणि पाठ',
      marriage: '💍 विवाह समारंभ',
      contact: '📞 पंडितजींशी संपर्क',
      language: '🌐 भाषा बदला',
    },
  };

  const t = translations[language];

  return buildListMessage({
    bodyText: t.body,
    buttonLabel: t.button,
    sections: [
      {
        title: t.services,
        rows: [
          { id: 'service_astrology', title: t.astrology },
          { id: 'service_vastu', title: t.vastu },
          { id: 'service_pooja', title: t.pooja },
          { id: 'service_marriage', title: t.marriage },
          { id: 'contact_pandit', title: t.contact },
          { id: 'change_language', title: t.language },
        ],
      },
    ],
  });
}
