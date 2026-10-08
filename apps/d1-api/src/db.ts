/**
 * Database utility helpers for D1
 * Generates UUIDs and timestamps for D1 (SQLite) compatibility
 */

/**
 * Generate a UUID v4 using the Web Crypto API available in Workers
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Return current timestamp as ISO 8601 string
 * D1 stores dates as TEXT in ISO format
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Parse JSON body safely from a Request
 */
export async function parseBody<T = unknown>(request: Request): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Validate that required string fields are present and non-empty
 */
export function requireFields(
  obj: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    const value = obj[field];
    if (value === undefined || value === null || value === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}
