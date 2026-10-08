/**
 * Admin routes — Protected read-only endpoints
 *
 * Authentication: ADMIN_API_KEY via X-Admin-Key header
 *
 * GET /api/admin/users
 * GET /api/admin/conversations
 * GET /api/admin/messages
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { env } from '../config/env.js';
import { getD1Client, isD1Available } from '../clients/d1-api.client.js';
import { logger } from '../utils/logger.js';

const admin = new Hono();

// ── Admin Authentication Middleware ──
const adminAuth: MiddlewareHandler = async (c, next) => {
  if (!env.ADMIN_API_KEY) {
    return c.json({ error: 'Admin API not configured' }, 503);
  }

  const key = c.req.header('x-admin-key') ?? c.req.header('authorization')?.replace('Bearer ', '');

  if (!key || key !== env.ADMIN_API_KEY) {
    logger.warn('Admin: unauthorized access attempt', { path: c.req.path });
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
};

admin.use('/*', adminAuth);

// ── Admin Endpoints ──

admin.get('/status', (c) => {
  return c.json({
    admin: true,
    d1_configured: isD1Available(),
    timestamp: new Date().toISOString(),
  });
});

admin.get('/users', async (c) => {
  if (!isD1Available()) {
    return c.json({ error: 'Database not configured' }, 503);
  }

  try {
    // For now, we list via knowledge endpoint as a proxy
    // In Phase 3, a proper admin dashboard will use these endpoints
    const client = getD1Client();
    const docs = await client.listKnowledge({ limit: 50 });

    return c.json({
      message: 'User listing requires admin database queries. Available in Phase 3.',
      knowledge_count: docs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: 'Database error' }, 500);
  }
});

admin.get('/conversations', async (c) => {
  return c.json({
    message: 'Conversation listing will be available in Phase 3 admin dashboard.',
  });
});

admin.get('/messages', async (c) => {
  return c.json({
    message: 'Message listing will be available in Phase 3 admin dashboard.',
  });
});

export { admin as adminRoutes };
