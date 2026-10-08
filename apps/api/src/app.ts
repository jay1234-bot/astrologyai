/**
 * Hono Application
 *
 * Assembles routes, middleware, and error handling.
 * Keep this file focused on composition only — no business logic here.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { healthRoutes } from './routes/health.routes.js';
import { webhookRoutes } from './routes/webhook.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { loggingMiddleware } from './middleware/logging.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { healthController } from './controllers/health.controller.js';

const app = new Hono();

// ── Security headers ──
app.use('*', secureHeaders());

// ── CORS (restrict in production via env) ──
app.use(
  '/api/*',
  cors({
    origin: '*', // Restrict to your frontend domain in production
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  })
);

// ── Request logging ──
app.use('*', loggingMiddleware);

// ── Routes ──

// Root health check
app.get('/', (c) => c.json({ service: 'pandit-harinath-ai', status: 'ok' }));

// Health endpoint
app.route('/health', healthRoutes);

// WhatsApp webhook
app.route('/webhook', webhookRoutes);

// API routes
app.get('/api/status', (c) => healthController.status(c));
app.route('/api/admin', adminRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
});

// Error handler
app.onError(errorMiddleware);

export { app };
