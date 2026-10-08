/**
 * Zod schemas for incoming webhook payload validation
 */

import { z } from 'zod';

// ============================================================
// Core webhook schemas
// ============================================================

const WhatsAppTextSchema = z.object({
  body: z.string(),
});

const WhatsAppMediaSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
});

const WhatsAppDocumentSchema = z.object({
  id: z.string(),
  filename: z.string().optional(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
});

const WhatsAppLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

const WhatsAppInteractiveSchema = z.object({
  type: z.enum(['button_reply', 'list_reply', 'nfm_reply']),
  button_reply: z
    .object({ id: z.string(), title: z.string() })
    .optional(),
  list_reply: z
    .object({ id: z.string(), title: z.string(), description: z.string().optional() })
    .optional(),
});

const WhatsAppButtonSchema = z.object({
  payload: z.string(),
  text: z.string(),
});

const WhatsAppContextSchema = z.object({
  from: z.string(),
  id: z.string(),
});

const WhatsAppMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.string(),
  context: WhatsAppContextSchema.optional(),
  text: WhatsAppTextSchema.optional(),
  image: WhatsAppMediaSchema.optional(),
  audio: WhatsAppMediaSchema.optional(),
  video: WhatsAppMediaSchema.optional(),
  document: WhatsAppDocumentSchema.optional(),
  location: WhatsAppLocationSchema.optional(),
  interactive: WhatsAppInteractiveSchema.optional(),
  button: WhatsAppButtonSchema.optional(),
  sticker: WhatsAppMediaSchema.optional(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});

const WhatsAppContactSchema = z.object({
  profile: z.object({ name: z.string() }),
  wa_id: z.string(),
});

const WhatsAppStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string(),
  recipient_id: z.string(),
});

const WhatsAppMetadataSchema = z.object({
  display_phone_number: z.string(),
  phone_number_id: z.string(),
});

const WhatsAppChangeValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: WhatsAppMetadataSchema,
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppMessageSchema).optional(),
  statuses: z.array(WhatsAppStatusSchema).optional(),
});

const WhatsAppChangeSchema = z.object({
  value: WhatsAppChangeValueSchema,
  field: z.string(),
});

const WhatsAppEntrySchema = z.object({
  id: z.string(),
  changes: z.array(WhatsAppChangeSchema),
});

export const WhatsAppWebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(WhatsAppEntrySchema),
});

// ============================================================
// Webhook verification (GET /webhook)
// ============================================================

export const WebhookVerificationQuerySchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

export type WhatsAppWebhookPayloadInput = z.infer<typeof WhatsAppWebhookPayloadSchema>;
