import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    // Default environment is Node (API tests). Component tests opt into jsdom
    // per-file via a `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-secret-do-not-use-in-production',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**', 'server.ts'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/pages/**', 'src/components/**'],
    },
  },
});
