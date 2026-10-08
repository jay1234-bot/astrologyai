-- ============================================================
-- Migration: 0001_initial.sql
-- Project: पंडित हरिनाथ शास्त्री AI WhatsApp Chatbot
-- Database: Cloudflare D1 (SQLite-compatible)
-- ============================================================


-- ============================================================
-- TABLE: users
-- Stores WhatsApp users who interact with the chatbot
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  whatsapp_user_id  TEXT UNIQUE NOT NULL,
  phone_number      TEXT,
  display_name      TEXT,
  preferred_language TEXT DEFAULT 'en' NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_whatsapp_user_id ON users(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_users_preferred_language ON users(preferred_language);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================
-- TABLE: conversations
-- Groups messages into conversation sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  status      TEXT DEFAULT 'active' NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);

-- ============================================================
-- TABLE: messages
-- Stores all incoming and outgoing messages
-- direction: 'inbound' (from customer) | 'outbound' (from bot)
-- message_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'interactive' | 'button' | 'status'
-- ai_generated: 0 = no, 1 = yes
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id                    TEXT PRIMARY KEY,
  conversation_id       TEXT NOT NULL,
  whatsapp_message_id   TEXT UNIQUE,
  direction             TEXT NOT NULL CHECK(direction IN ('inbound', 'outbound')),
  message_type          TEXT NOT NULL,
  content               TEXT,
  language              TEXT,
  ai_generated          INTEGER DEFAULT 0 NOT NULL,
  metadata              TEXT,
  created_at            TEXT NOT NULL,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id ON messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);

-- ============================================================
-- TABLE: knowledge_documents
-- Business knowledge for AI retrieval
-- category: 'astrology' | 'vastu' | 'pooja' | 'marriage' | 'general' | 'services'
-- active: 1 = enabled, 0 = disabled
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  content     TEXT NOT NULL,
  language    TEXT DEFAULT 'en' NOT NULL,
  active      INTEGER DEFAULT 1 NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_language ON knowledge_documents(language);
CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_documents(active);
CREATE INDEX IF NOT EXISTS idx_knowledge_category_language ON knowledge_documents(category, language, active);

-- Full-text search on knowledge documents (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title,
  content,
  category,
  language,
  content=knowledge_documents,
  content_rowid=rowid,
  tokenize='porter ascii'
);

-- FTS triggers to keep knowledge_fts in sync
CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge_documents BEGIN
  INSERT INTO knowledge_fts(rowid, title, content, category, language)
  VALUES (new.rowid, new.title, new.content, new.category, new.language);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge_documents BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, category, language)
  VALUES ('delete', old.rowid, old.title, old.content, old.category, old.language);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge_documents BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, category, language)
  VALUES ('delete', old.rowid, old.title, old.content, old.category, old.language);
  INSERT INTO knowledge_fts(rowid, title, content, category, language)
  VALUES (new.rowid, new.title, new.content, new.category, new.language);
END;

-- ============================================================
-- TABLE: processed_webhooks
-- Deduplication table to prevent processing the same
-- WhatsApp message twice (Meta may retry webhook delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS processed_webhooks (
  id                    TEXT PRIMARY KEY,
  whatsapp_message_id   TEXT UNIQUE NOT NULL,
  event_type            TEXT,
  processed_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_message_id ON processed_webhooks(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_processed_webhooks_processed_at ON processed_webhooks(processed_at);
