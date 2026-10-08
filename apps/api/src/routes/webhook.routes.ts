/**
 * Webhook routes — Meta WhatsApp Cloud API endpoints
 *
 * GET  /webhook — Meta verification handshake
 * POST /webhook — Incoming messages (signature verified by middleware)
 */

import { Hono } from 'hono';
import { webhookController } from '../controllers/webhook.controller.js';
import { webhookSignatureMiddleware } from '../middleware/webhook.middleware.js';

const webhook = new Hono();

// GET /webhook — Meta verification (no auth required)
webhook.get('/', (c) => webhookController.verify(c));

// POST /webhook — Incoming messages (signature verification middleware)
webhook.post('/', webhookSignatureMiddleware, (c) => webhookController.receive(c));

export { webhook as webhookRoutes };
