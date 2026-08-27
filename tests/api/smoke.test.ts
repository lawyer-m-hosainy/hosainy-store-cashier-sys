import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { freshApp } from '../helpers/testApp';

let app: Express;

beforeEach(async () => {
  app = await freshApp();
});

describe('smoke', () => {
  it('reports setup needed on a fresh database', async () => {
    const res = await request(app).get('/api/auth/check-setup');
    expect(res.status).toBe(200);
    expect(res.body.needsSetup).toBe(true);
  });

  it('isolates state between tests (still fresh here too)', async () => {
    const res = await request(app).get('/api/auth/check-setup');
    expect(res.body.needsSetup).toBe(true);
  });
});
