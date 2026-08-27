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

describe('POST /api/sales', () => {
  it('rejects an empty cart', async () => {
    const res = await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({ type: 'instore', payment_method: 'cash', items: [] });
    expect(res.status).toBe(400);
  });

  it('recomputes price from the database, ignoring a tampered client price', async () => {
    const product = await createProduct(app, token, { sell_price: 25, current_stock: 10 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', items: [{ product_id: product.id, qty: 2, unit_price: 0.01 }] });

    expect(res.status).toBe(200);
    // 2 * 25 (real sell_price), not 2 * 0.01 (tampered client price)
    expect(res.body.total).toBe(50);
  });

  it('rejects a sale that would oversell stock, and leaves stock untouched', async () => {
    const product = await createProduct(app, token, { current_stock: 3 });

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', items: [{ product_id: product.id, qty: 999 }] });

    expect(res.status).toBe(400);

    const productsRes = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
    const stillThere = productsRes.body.find((p: any) => p.id === product.id);
    expect(stillThere.current_stock).toBe(3);
  });

  it('decrements stock by the sold quantity on success', async () => {
    const product = await createProduct(app, token, { current_stock: 10 });

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', items: [{ product_id: product.id, qty: 4 }] });

    const productsRes = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`);
    const updated = productsRes.body.find((p: any) => p.id === product.id);
    expect(updated.current_stock).toBe(6);
  });

  it('rejects a sale referencing a nonexistent product', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', items: [{ product_id: 99999, qty: 1 }] });
    expect(res.status).toBe(400);
  });

  it('links an existing customer via customer_id', async () => {
    const product = await createProduct(app, token);
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ahmed', phone: '0100000000', address: '', source: 'instore', notes: '' });
    const customerId = custRes.body.id;

    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', customer_id: customerId, items: [{ product_id: product.id, qty: 1 }] });

    const today = new Date().toISOString().split('T')[0];
    const reportRes = await request(app)
      .get(`/api/reports?start=${today}&end=${today}`)
      .set('Authorization', `Bearer ${token}`);

    expect(reportRes.body.topCustomers).toHaveLength(1);
    expect(reportRes.body.topCustomers[0].phone).toBe('0100000000');
  });

  it('clamps points redemption to the customer\'s actual balance', async () => {
    const product = await createProduct(app, token, { sell_price: 20 });
    const custRes = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sara', phone: '0111111111', address: '', source: 'instore', notes: '' });
    const customerId = custRes.body.id;

    // Customer starts with 0 points; trying to redeem 500 should clamp to 0, never go negative.
    await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'instore', payment_method: 'cash', customer_id: customerId, points_redeemed: 500, items: [{ product_id: product.id, qty: 1 }] });

    const customersRes = await request(app).get('/api/customers').set('Authorization', `Bearer ${token}`);
    const customer = customersRes.body.find((c: any) => c.id === customerId);
    expect(customer.points).toBeGreaterThanOrEqual(0);
  });
});
