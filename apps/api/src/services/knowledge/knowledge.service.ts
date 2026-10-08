/**
 * Knowledge Service
 *
 * Retrieves relevant business knowledge for AI context.
 * Uses D1 FTS5 search as the primary mechanism.
 *
 * Architecture designed for future vector/embedding search:
 * - The interface (searchKnowledge method) stays stable
 * - Only the internal retrieval mechanism changes in future phases
 */

import { getD1Client, isD1Available } from '../../clients/d1-api.client.js';
import { DEFAULT_KNOWLEDGE_SEARCH_LIMIT } from '../../config/constants.js';
import { logger } from '../../utils/logger.js';
import type { KnowledgeDocument } from '../../types/ai.types.js';
import type { SupportedLanguage } from '../../config/constants.js';

export class KnowledgeService {
  /**
   * Search the knowledge base for documents relevant to the user's message.
   *
   * In Phase 8, this method will be extended to support:
   * - Gemini embeddings
   * - Vector similarity search
   *
   * The interface stays stable — only the implementation changes.
   *
   * @returns Array of relevant knowledge documents (may be empty)
   */
  async searchKnowledge(params: {
    query: string;
    language: SupportedLanguage;
    limit?: number;
  }): Promise<KnowledgeDocument[]> {
    if (!isD1Available()) {
      logger.debug('D1 not available, skipping knowledge search');
      return [];
    }

    const { query, language, limit = DEFAULT_KNOWLEDGE_SEARCH_LIMIT } = params;

    try {
      const client = getD1Client();

      // Search in user's language first
      let documents = await client.searchKnowledge({ query, language, limit });

      // If no results in user's language, try English as fallback
      if (documents.length === 0 && language !== 'en') {
        logger.debug('No knowledge found in user language, falling back to English', {
          language,
        });
        documents = await client.searchKnowledge({ query, language: 'en', limit });
      }

      if (documents.length > 0) {
        logger.debug('Knowledge retrieved', {
          count: documents.length,
          categories: [...new Set(documents.map((d) => d.category))],
        });
      }

      return documents;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Knowledge search failed', { error: message });
      // Non-fatal — return empty, AI will answer without knowledge context
      return [];
    }
  }
}

// Singleton
let _knowledgeService: KnowledgeService | null = null;

export function getKnowledgeService(): KnowledgeService {
  if (!_knowledgeService) {
    _knowledgeService = new KnowledgeService();
  }
  return _knowledgeService;
}
