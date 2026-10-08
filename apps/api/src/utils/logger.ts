/**
 * Structured logger
 *
 * NEVER logs secrets, API keys, tokens, or authorization headers.
 * Outputs JSON in production, human-readable in development.
 */

import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

// Fields that must NEVER be logged
const FORBIDDEN_FIELDS = new Set([
  'GEMINI_API_KEY',
  'gemini_api_key',
  'WHATSAPP_ACCESS_TOKEN',
  'whatsapp_access_token',
  'META_APP_SECRET',
  'meta_app_secret',
  'D1_API_SECRET',
  'd1_api_secret',
  'ADMIN_API_KEY',
  'admin_api_key',
  'authorization',
  'Authorization',
  'x-hub-signature-256',
  'X-Hub-Signature-256',
  'token',
  'secret',
  'password',
  'apiKey',
  'api_key',
]);

/**
 * Redact any forbidden fields from an object before logging
 */
function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      safe[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = redact(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

class Logger {
  private readonly service: string;

  constructor(service = 'pandit-harinath-ai') {
    this.service = service;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...(context ? redact(context) : {}),
    };

    const output = env.NODE_ENV === 'production' ? JSON.stringify(entry) : this.format(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  private format(entry: LogEntry): string {
    const { level, message, timestamp, service, ...rest } = entry;
    const levelStr = level.toUpperCase().padEnd(5);
    const meta = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    return `${timestamp} [${levelStr}] [${service}] ${message}${meta}`;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (env.NODE_ENV !== 'production') {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(
    private readonly parent: Logger,
    private readonly context: Record<string, unknown>
  ) {}

  private merge(extra?: Record<string, unknown>): Record<string, unknown> {
    return { ...this.context, ...extra };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, this.merge(context));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, this.merge(context));
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, this.merge(context));
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(message, this.merge(context));
  }
}

export const logger = new Logger();
export type { ChildLogger };
