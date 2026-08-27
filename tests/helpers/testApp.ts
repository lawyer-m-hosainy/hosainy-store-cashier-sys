import { vi } from 'vitest';

/**
 * Builds a brand-new Express app backed by a fresh in-memory SQLite database.
 * Call this in a beforeEach so every test gets full isolation — no leftover
 * users/products/sales from a previous test in the same file.
 */
export async function freshApp() {
  vi.resetModules();
  const { createApp } = await import('../../src/expressApp');
  return createApp();
}
