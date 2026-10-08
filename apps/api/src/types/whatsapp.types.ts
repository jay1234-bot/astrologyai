/**
 * WhatsApp Cloud API type definitions
 * Based on Meta WhatsApp Cloud API documentation
 */

// ============================================================
// Webhook payload types (incoming from Meta)
// ============================================================

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// ============================================================
// Message types (incoming)
// ============================================================

export interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WhatsAppMessageType;
  context?: WhatsAppContext;
  text?: WhatsAppTextContent;
  image?: WhatsAppMediaContent;
  audio?: WhatsAppMediaContent;
  video?: WhatsAppMediaContent;
  document?: WhatsAppDocumentContent;
  location?: WhatsAppLocationContent;
  interactive?: WhatsAppInteractiveContent;
  button?: WhatsAppButtonContent;
  sticker?: WhatsAppMediaContent;
  reaction?: WhatsAppReactionContent;
  contacts?: WhatsAppContactContent[];
  errors?: WhatsAppError[];
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'
  | 'button'
  | 'sticker'
  | 'reaction'
  | 'contacts'
  | 'order'
  | 'system'
  | 'unknown';

export interface WhatsAppContext {
  from: string;
  id: string;
}

export interface WhatsAppTextContent {
  body: string;
}

export interface WhatsAppMediaContent {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppDocumentContent {
  id: string;
  filename?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppInteractiveContent {
  type: 'button_reply' | 'list_reply' | 'nfm_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface WhatsAppButtonContent {
  payload: string;
  text: string;
}

export interface WhatsAppReactionContent {
  message_id: string;
  emoji: string;
}

export interface WhatsAppContactContent {
  name?: {
    first_name?: string;
    last_name?: string;
    formatted_name?: string;
  };
  phones?: Array<{
    phone?: string;
    type?: string;
    wa_id?: string;
  }>;
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppError[];
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: { type: string };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

export interface WhatsAppError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details?: string;
  };
}

// ============================================================
// Outbound message types (sending to Meta)
// ============================================================

export interface SendTextMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
}

export interface SendImageMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'image';
  image: {
    link?: string;
    id?: string;
    caption?: string;
  };
}

export interface SendDocumentMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'document';
  document: {
    link?: string;
    id?: string;
    caption?: string;
    filename?: string;
  };
}

export interface SendInteractiveMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: InteractiveObject;
}

export interface InteractiveObject {
  type: 'button' | 'list' | 'cta_url' | 'flow';
  header?: InteractiveHeader;
  body: { text: string };
  footer?: { text: string };
  action: InteractiveAction;
}

export interface InteractiveHeader {
  type: 'text' | 'image' | 'document' | 'video';
  text?: string;
}

export interface InteractiveAction {
  buttons?: Array<{
    type: 'reply';
    reply: { id: string; title: string };
  }>;
  button?: string;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface WhatsAppApiSendResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
}

// ============================================================
// Parsed / normalized message for internal use
// ============================================================

export interface ParsedIncomingMessage {
  messageId: string;
  from: string;         // WhatsApp user ID (wa_id)
  displayName: string;
  timestamp: Date;
  type: WhatsAppMessageType;
  text?: string;        // text body if type === 'text'
  mediaId?: string;
  mediaCaption?: string;
  locationData?: WhatsAppLocationContent;
  interactiveData?: WhatsAppInteractiveContent;
  buttonData?: WhatsAppButtonContent;
  rawMessage: WhatsAppMessage;
}
