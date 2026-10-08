/**
 * Health routes
 */

import { Hono } from 'hono';
import { healthController } from '../controllers/health.controller.js';

const health = new Hono();

health.get('/', (c) => healthController.health(c));

export { health as healthRoutes };
