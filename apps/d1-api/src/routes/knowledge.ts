/**
 * Knowledge route handler for the D1 API Worker
 *
 * POST /knowledge/search — Full-text search using FTS5
 * POST /knowledge/list  — List knowledge documents by category
 *
 * Designed to support future vector/embedding search by keeping
 * the interface stable — only the retrieval mechanism changes internally.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { parseBody, requireFields } from '../db';

interface SearchKnowledgeBody {
  query: string;
  language?: string;
  category?: string;
  limit?: number;
}

interface ListKnowledgeBody {
  category?: string;
  language?: string;
  limit?: number;
}

export async function handleKnowledge(
  request: Request,
  env: Env,
  action: 'search' | 'list'
): Promise<Response> {
  if (action === 'search') {
    return searchKnowledge(request, env);
  }
  if (action === 'list') {
    return listKnowledge(request, env);
  }
  return jsonResponse({ error: 'Unknown action' }, 400);
}

async function searchKnowledge(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);

  if (!body) {
    return jsonResponse({ error: 'Invalid or missing JSON body' }, 400);
  }

  const validationError = requireFields(body, ['query']);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const data = body as SearchKnowledgeBody;
  const query = String(data.query).trim();

  if (query.length < 2) {
    return jsonResponse({ documents: [], count: 0 });
  }

  const language = data.language ? String(data.language).trim() : null;
  const category = data.category ? String(data.category).trim() : null;
  const rawLimit = data.limit ? parseInt(String(data.limit), 10) : 5;
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 5 : rawLimit, 1), 20);

  try {
    // Sanitize the query for FTS5: escape special chars, add * for prefix matching
    const ftsQuery = sanitizeFtsQuery(query);

    let ftsResult: D1Result<Record<string, unknown>>;

    if (language && category) {
      ftsResult = await env.DB.prepare(
        `SELECT kd.id, kd.title, kd.category, kd.content, kd.language, kd.active
         FROM knowledge_fts kf
         JOIN knowledge_documents kd ON kf.rowid = kd.rowid
         WHERE knowledge_fts MATCH ?
           AND kd.language = ?
           AND kd.category = ?
           AND kd.active = 1
         ORDER BY rank
         LIMIT ?`
      )
        .bind(ftsQuery, language, category, limit)
        .all();
    } else if (language) {
      ftsResult = await env.DB.prepare(
        `SELECT kd.id, kd.title, kd.category, kd.content, kd.language, kd.active
         FROM knowledge_fts kf
         JOIN knowledge_documents kd ON kf.rowid = kd.rowid
         WHERE knowledge_fts MATCH ?
           AND kd.language = ?
           AND kd.active = 1
         ORDER BY rank
         LIMIT ?`
      )
        .bind(ftsQuery, language, limit)
        .all();
    } else if (category) {
      ftsResult = await env.DB.prepare(
        `SELECT kd.id, kd.title, kd.category, kd.content, kd.language, kd.active
         FROM knowledge_fts kf
         JOIN knowledge_documents kd ON kf.rowid = kd.rowid
         WHERE knowledge_fts MATCH ?
           AND kd.category = ?
           AND kd.active = 1
         ORDER BY rank
         LIMIT ?`
      )
        .bind(ftsQuery, category, limit)
        .all();
    } else {
      ftsResult = await env.DB.prepare(
        `SELECT kd.id, kd.title, kd.category, kd.content, kd.language, kd.active
         FROM knowledge_fts kf
         JOIN knowledge_documents kd ON kf.rowid = kd.rowid
         WHERE knowledge_fts MATCH ?
           AND kd.active = 1
         ORDER BY rank
         LIMIT ?`
      )
        .bind(ftsQuery, limit)
        .all();
    }

    const documents = ftsResult.results ?? [];
    return jsonResponse({ documents, count: documents.length, query });
  } catch (err) {
    // FTS5 query might fail on malformed query — fall back to LIKE search
    console.warn('[D1-API] FTS5 search failed, falling back to LIKE:', err);
    return fallbackLikeSearch(env, query, language, category, limit);
  }
}

async function fallbackLikeSearch(
  env: Env,
  query: string,
  language: string | null,
  category: string | null,
  limit: number
): Promise<Response> {
  try {
    const likePattern = `%${query.replace(/%/g, '')}%`;

    const result = await env.DB.prepare(
      `SELECT id, title, category, content, language, active
       FROM knowledge_documents
       WHERE active = 1
         AND (title LIKE ? OR content LIKE ?)
         ${language ? 'AND language = ?' : ''}
         ${category ? 'AND category = ?' : ''}
       LIMIT ?`
    )
      .bind(
        ...[
          likePattern,
          likePattern,
          ...(language ? [language] : []),
          ...(category ? [category] : []),
          limit,
        ]
      )
      .all();

    return jsonResponse({
      documents: result.results ?? [],
      count: (result.results ?? []).length,
      query,
      fallback: true,
    });
  } catch (fallbackErr) {
    const message = fallbackErr instanceof Error ? fallbackErr.message : 'Database error';
    console.error('[D1-API] knowledge fallback search error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}

async function listKnowledge(request: Request, env: Env): Promise<Response> {
  const body = await parseBody<Record<string, unknown>>(request);
  const data = (body ?? {}) as ListKnowledgeBody;

  const category = data.category ? String(data.category).trim() : null;
  const language = data.language ? String(data.language).trim() : null;
  const rawLimit = data.limit ? parseInt(String(data.limit), 10) : 10;
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 50);

  try {
    let result: D1Result<Record<string, unknown>>;

    if (category && language) {
      result = await env.DB.prepare(
        `SELECT id, title, category, content, language, active, created_at, updated_at
         FROM knowledge_documents
         WHERE active = 1 AND category = ? AND language = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
        .bind(category, language, limit)
        .all();
    } else if (category) {
      result = await env.DB.prepare(
        `SELECT id, title, category, content, language, active, created_at, updated_at
         FROM knowledge_documents
         WHERE active = 1 AND category = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
        .bind(category, limit)
        .all();
    } else if (language) {
      result = await env.DB.prepare(
        `SELECT id, title, category, content, language, active, created_at, updated_at
         FROM knowledge_documents
         WHERE active = 1 AND language = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
        .bind(language, limit)
        .all();
    } else {
      result = await env.DB.prepare(
        `SELECT id, title, category, content, language, active, created_at, updated_at
         FROM knowledge_documents
         WHERE active = 1
         ORDER BY created_at DESC
         LIMIT ?`
      )
        .bind(limit)
        .all();
    }

    return jsonResponse({ documents: result.results ?? [], count: (result.results ?? []).length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error';
    console.error('[D1-API] knowledge/list error:', message);
    return jsonResponse({ error: 'Database error' }, 500);
  }
}

/**
 * Sanitize a user query string for FTS5 to prevent injection and malformed queries.
 * Adds a wildcard suffix for prefix matching.
 */
function sanitizeFtsQuery(query: string): string {
  // Remove FTS5 special characters that could cause syntax errors
  const sanitized = query
    .replace(/['"*()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return '""';

  // Split into tokens and add * suffix for prefix matching
  const tokens = sanitized.split(' ').filter(Boolean);
  return tokens.map((t) => `"${t}"*`).join(' OR ');
}
