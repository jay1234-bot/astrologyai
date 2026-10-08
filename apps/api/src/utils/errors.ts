/**
 * Centralized application errors
 * Typed error classes for clean error handling throughout the app
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class WebhookSignatureError extends AppError {
  constructor(message = 'Invalid webhook signature') {
    super(message, 'WEBHOOK_SIGNATURE_ERROR', 403);
    this.name = 'WebhookSignatureError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR', 429);
    this.name = 'RateLimitError';
  }
}

export class D1ApiError extends AppError {
  constructor(message: string, public readonly d1Status?: number) {
    super(message, 'D1_API_ERROR', 502);
    this.name = 'D1ApiError';
  }
}

export class GeminiError extends AppError {
  constructor(message: string) {
    super(message, 'GEMINI_ERROR', 502);
    this.name = 'GeminiError';
  }
}

export class WhatsAppApiError extends AppError {
  constructor(message: string, public readonly waStatus?: number) {
    super(message, 'WHATSAPP_API_ERROR', 502);
    this.name = 'WhatsAppApiError';
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 503);
    this.name = 'ConfigurationError';
  }
}

export class DuplicateMessageError extends AppError {
  constructor(messageId: string) {
    super(`Message ${messageId} already processed`, 'DUPLICATE_MESSAGE', 200);
    this.name = 'DuplicateMessageError';
  }
}

/**
 * Safe error message for customer-facing responses
 * Never exposes stack traces or internal details
 */
export function getSafeErrorMessage(err: unknown, language = 'en'): string {
  const messages: Record<string, string> = {
    en: 'I encountered a technical issue. Please try again in a moment.',
    hi: 'मुझे एक तकनीकी समस्या हुई। कृपया एक पल में पुनः प्रयास करें।',
    mr: 'मला एक तांत्रिक समस्या आली. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.',
  };

  // If it's a known operational error with a safe message, we might use it
  if (err instanceof AppError && err.isOperational && err.statusCode < 500) {
    return err.message;
  }

  return messages[language] ?? messages['en']!;
}
