import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/app.js';

describe('GET /health', () => {
  it('returns 200 with service info', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('pandit-harinath-ai');
    expect(body.timestamp).toBeDefined();
    expect(body.environment).toBeDefined();
  });

  it('does not expose secrets', async () => {
    const res = await app.request('/health');
    const body = await res.text();
    expect(body).not.toContain('GEMINI_API_KEY');
    expect(body).not.toContain('WHATSAPP_ACCESS_TOKEN');
    expect(body).not.toContain('META_APP_SECRET');
    expect(body).not.toContain('D1_API_SECRET');
    expect(body).not.toContain('ADMIN_API_KEY');
  });

  it('root path returns service info', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.service).toBe('pandit-harinath-ai');
  });
});
