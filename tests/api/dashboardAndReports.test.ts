import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { freshApp } from '../helpers/testApp';
import { createUser, setupOwner } from '../helpers/auth';
import { createProduct } from '../helpers/products';

let app: Express;
let ownerToken: string;

beforeEach(async () => {
  app = await freshApp();
  ({ token: ownerToken } = await setupOwner(app));
});

function today() {
  return new Date().toISOString().split('T')[0];
}

async function sell(app: Express, token: string, productId: number, qty: number, extra: Record<string, any> = {}) {
  return request(app)
    .post('/api/sales')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'instore', payment_method: 'cash', items: [{ product_id: productId, qty }], ...extra });
}

describe('GET /api/dashboard/today', () => {
  it('is owner-only', async () => {
    const employee = await createUser(app, ownerToken);
    const res = await request(app).get('/api/dashboard/today').set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });

  it('aggregates today\'s sales correctly', async () => {
    const product = await createProduct(app, ownerToken, { sell_price: 25, cost_price: 10, current_stock: 100 });
    await sell(app, ownerToken, product.id, 2, { type: 'instore' }); // 50
    await sell(app, ownerToken, product.id, 1, { type: 'delivery' }); // 25

    const res = await request(app).get('/api/dashboard/today').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.instoreTotal).toBe(50);
    expect(res.body.deliveryTotal).toBe(25);
    expect(res.body.totalSales).toBe(75);
    expect(res.body.orderCount).toBe(2);
    expect(res.body.grossProfit).toBe(45); // 3 units * (25-10)
    expect(res.body.topProductsToday[0].id).toBe(product.id);
  });
});

describe('GET /api/dashboard/alerts', () => {
  it('is owner-only', async () => {
    const employee = await createUser(app, ownerToken);
    const res = await request(app).get('/api/dashboard/alerts').set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });

  it('buckets products correctly by stock and expiry', async () => {
    const outOfStock = await createProduct(app, ownerToken, { name: 'Out', current_stock: 0, reorder_level: 5 });
    const lowStock = await createProduct(app, ownerToken, { name: 'Low', current_stock: 3, reorder_level: 5 });
    const healthy = await createProduct(app, ownerToken, { name: 'Healthy', current_stock: 50, reorder_level: 5 });

    const in10Days = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0];
    const expiringSoon = await createProduct(app, ownerToken, { name: 'Expiring', current_stock: 10, reorder_level: 1, has_expiry: true, expiry_date: in10Days });
    const expired = await createProduct(app, ownerToken, { name: 'Expired', current_stock: 10, reorder_level: 1, has_expiry: true, expiry_date: yesterday });

    const res = await request(app).get('/api/dashboard/alerts').set('Authorization', `Bearer ${ownerToken}`);

    expect(res.body.outOfStock.map((p: any) => p.id)).toEqual([outOfStock.id]);
    expect(res.body.lowStock.map((p: any) => p.id)).toEqual([lowStock.id]);
    expect(res.body.expiringSoon.map((p: any) => p.id)).toEqual([expiringSoon.id]);
    expect(res.body.expired.map((p: any) => p.id)).toEqual([expired.id]);

    const allBucketedIds = [
      ...res.body.outOfStock,
      ...res.body.lowStock,
      ...res.body.expiringSoon,
      ...res.body.expired,
    ].map((p: any) => p.id);
    expect(allBucketedIds).not.toContain(healthy.id);
  });
});

describe('GET /api/reports', () => {
  it('is owner-only', async () => {
    const employee = await createUser(app, ownerToken);
    const res = await request(app).get(`/api/reports?start=${today()}&end=${today()}`).set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });

  it('computes totals, top products, and payment-method breakdown', async () => {
    const productA = await createProduct(app, ownerToken, { name: 'A', sell_price: 100, cost_price: 60, current_stock: 100 });
    const productB = await createProduct(app, ownerToken, { name: 'B', sell_price: 20, cost_price: 5, current_stock: 100 });

    await sell(app, ownerToken, productA.id, 1, { payment_method: 'cash' }); // 100, profit 40
    await sell(app, ownerToken, productB.id, 3, { payment_method: 'card' }); // 60, profit 45

    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ date: today(), category: 'rent', amount: 50, description: 'rent' });

    const res = await request(app).get(`/api/reports?start=${today()}&end=${today()}`).set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalSales).toBe(160);
    expect(res.body.grossProfit).toBe(85);
    expect(res.body.totalExpenses).toBe(50);
    expect(res.body.netProfit).toBe(35);

    expect(res.body.topProducts[0].id).toBe(productA.id); // higher revenue first
    expect(res.body.topProducts[0].revenue).toBe(100);
    expect(res.body.topProducts[1].id).toBe(productB.id);

    const byMethod = Object.fromEntries(res.body.salesByPaymentMethod.map((m: any) => [m.payment_method, m.total]));
    expect(byMethod.cash).toBe(100);
    expect(byMethod.card).toBe(60);
  });

  it('lists products with no sales in the last 30 days as stagnant', async () => {
    const stagnant = await createProduct(app, ownerToken, { name: 'Dusty', current_stock: 5 });
    const res = await request(app).get(`/api/reports?start=${today()}&end=${today()}`).set('Authorization', `Bearer ${ownerToken}`);
    expect(res.body.stagnantProducts.map((p: any) => p.id)).toContain(stagnant.id);
  });
});
