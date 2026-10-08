import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.types.ts'],
    },
    // Set test environment variables
    env: {
      NODE_ENV: 'test',
      PORT: '3001',
      GEMINI_MODEL: 'gemini-1.5-flash',
      DEFAULT_LANGUAGE: 'en',
      AI_ENABLED: 'true',
      AI_CONTEXT_MESSAGE_LIMIT: '15',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_REQUESTS: '30',
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
