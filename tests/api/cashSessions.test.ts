import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { freshApp } from '../helpers/testApp';
import { setupOwner } from '../helpers/auth';
import { createProduct } from '../helpers/products';

let app: Express;
let token: string;

beforeEach(async () => {
  app = await freshApp();
  ({ token } = await setupOwner(app));
});

function today() {
  return new Date().toISOString().split('T')[0];
}

describe('cash sessions', () => {
  it('opens a session', async () => {
    const res = await request(app)
      .post('/api/cash-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: today(), opening_balance: 100 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it('refuses to open a second session while one is already open', async () => {
    await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 100 });
    const res = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 50 });
    expect(res.status).toBe(409);
  });

  it('reports the open session via /active', async () => {
    const openRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 100 });
    const activeRes = await request(app).get('/api/cash-sessions/active').set('Authorization', `Bearer ${token}`);
    expect(activeRes.body.id).toBe(openRes.body.id);
    expect(activeRes.body.status).toBe('open');
  });

  it('404s when closing a session that does not exist', async () => {
    const res = await request(app)
      .post('/api/cash-sessions/99999/close')
      .set('Authorization', `Bearer ${token}`)
      .send({ closing_balance_actual: 100 });
    expect(res.status).toBe(404);
  });

  it('closes a session with no sales: expected equals opening balance', async () => {
    const openRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 200 });

    const closeRes = await request(app)
      .post(`/api/cash-sessions/${openRes.body.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closing_balance_actual: 200 });

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.expected).toBe(200);
    expect(closeRes.body.difference).toBe(0);
  });

  it('sums only cash sales (not card) from this session into the expected total', async () => {
    const product = await createProduct(app, token, { sell_price: 30, current_stock: 20 });
    const openRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 100 });
    const sessionId = openRes.body.id;

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', cash_session_id: sessionId, items: [{ product_id: product.id, qty: 2 }] }); // 60 cash

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'card', cash_session_id: sessionId, items: [{ product_id: product.id, qty: 1 }] }); // 30 card, should NOT count

    const closeRes = await request(app)
      .post(`/api/cash-sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closing_balance_actual: 160 });

    // opening 100 + cash sales 60 = 160, card sale excluded
    expect(closeRes.body.expected).toBe(160);
    expect(closeRes.body.difference).toBe(0);
  });

  it('reports a shortage/overage difference correctly', async () => {
    const openRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 100 });

    const closeRes = await request(app)
      .post(`/api/cash-sessions/${openRes.body.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closing_balance_actual: 90 }); // 10 short

    expect(closeRes.body.expected).toBe(100);
    expect(closeRes.body.difference).toBe(-10);
  });

  it('allows opening a new session after the previous one is closed', async () => {
    const openRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 100 });
    const closeRes = await request(app)
      .post(`/api/cash-sessions/${openRes.body.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ closing_balance_actual: 100 });
    expect(closeRes.status).toBe(200);

    const reopenRes = await request(app).post('/api/cash-sessions').set('Authorization', `Bearer ${token}`).send({ date: today(), opening_balance: 50 });
    expect(reopenRes.status).toBe(200);
  });
});
