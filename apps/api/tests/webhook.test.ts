import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { app } from '../src/app.js';

// ── Helpers ──

function makeSignature(body: string, secret: string): string {
  const hmac = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${hmac}`;
}

const TEST_SECRET = 'test-meta-app-secret';
const TEST_VERIFY_TOKEN = 'test-verify-token';

// Mock env
vi.mock('../src/config/env.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config/env.js')>();
  return {
    ...actual,
    env: {
      ...actual.env,
      META_APP_SECRET: TEST_SECRET,
      WHATSAPP_VERIFY_TOKEN: TEST_VERIFY_TOKEN,
      NODE_ENV: 'test',
    },
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    isGeminiConfigured: false,
    isWhatsAppConfigured: false,
    isD1Configured: false,
  };
});

// ── Webhook Verification (GET) ──

describe('GET /webhook — Meta verification', () => {
  it('returns 200 with challenge on valid token', async () => {
    const challenge = 'test_challenge_12345';
    const res = await app.request(
      `/webhook?hub.mode=subscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=${challenge}`
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe(challenge);
  });

  it('returns 403 on wrong verify token', async () => {
    const res = await app.request(
      '/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=abc'
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 on wrong mode', async () => {
    const res = await app.request(
      `/webhook?hub.mode=unsubscribe&hub.verify_token=${TEST_VERIFY_TOKEN}&hub.challenge=abc`
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on missing params', async () => {
    const res = await app.request('/webhook?hub.mode=subscribe');
    expect(res.status).toBe(400);
  });
});

// ── Webhook POST — Signature Validation ──

const validTextPayload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '919876543210',
              phone_number_id: '123456',
            },
            contacts: [{ profile: { name: 'Test User' }, wa_id: '919876543210' }],
            messages: [
              {
                id: 'wamid.test123',
                from: '919876543210',
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text',
                text: { body: 'Hello, I need help with astrology' },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
});

describe('POST /webhook — Signature Validation', () => {
  it('returns 200 with valid signature', async () => {
    const signature = makeSignature(validTextPayload, TEST_SECRET);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: validTextPayload,
    });
    // Should return 200 (background processing)
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe('received');
  });

  it('returns 403 with invalid signature', async () => {
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalidsignature',
      },
      body: validTextPayload,
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 with missing signature header', async () => {
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: validTextPayload,
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with malformed JSON payload (prevents Meta retries)', async () => {
    const malformedBody = 'not-json';
    const signature = makeSignature(malformedBody, TEST_SECRET);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: malformedBody,
    });
    expect(res.status).toBe(200);
  });
});

// ── Payload Parsing ──

describe('POST /webhook — Payload parsing', () => {
  it('accepts whatsapp_business_account payload', async () => {
    const signature = makeSignature(validTextPayload, TEST_SECRET);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: validTextPayload,
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for invalid payload structure (prevents retries)', async () => {
    const badPayload = JSON.stringify({ object: 'wrong_type', entry: [] });
    const signature = makeSignature(badPayload, TEST_SECRET);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: badPayload,
    });
    expect(res.status).toBe(200);
  });
});
