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

describe('products', () => {
  it('lets the owner create a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sku: 'ABC123', name: 'Test', cost_price: 5, sell_price: 10, current_stock: 20, reorder_level: 5 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  it('blocks an employee from creating a product', async () => {
    const employee = await createUser(app, ownerToken);
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ sku: 'ABC123', name: 'Test', cost_price: 5, sell_price: 10, current_stock: 20, reorder_level: 5 });
    expect(res.status).toBe(403);
  });

  it('rejects a duplicate SKU', async () => {
    await createProduct(app, ownerToken, { sku: 'DUP-1' });
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sku: 'DUP-1', name: 'Other', cost_price: 5, sell_price: 10, current_stock: 1, reorder_level: 1 });
    expect(res.status).toBe(400);
  });

  it('hides cost_price from non-owner roles', async () => {
    await createProduct(app, ownerToken, { cost_price: 7, sell_price: 15 });
    const employee = await createUser(app, ownerToken);

    const res = await request(app).get('/api/products').set('Authorization', `Bearer ${employee.token}`);
    expect(res.body[0].cost_price).toBeUndefined();
    expect(res.body[0].sell_price).toBe(15);
  });

  it('shows cost_price to the owner', async () => {
    await createProduct(app, ownerToken, { cost_price: 7, sell_price: 15 });
    const res = await request(app).get('/api/products').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.body[0].cost_price).toBe(7);
  });

  it('edits a product and logs the change to the audit log', async () => {
    const product = await createProduct(app, ownerToken, { name: 'Before', sell_price: 10 });

    const editRes = await request(app)
      .put(`/api/products/${product.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...product, name: 'After', sell_price: 12 });
    expect(editRes.status).toBe(200);

    const productsRes = await request(app).get('/api/products').set('Authorization', `Bearer ${ownerToken}`);
    const updated = productsRes.body.find((p: any) => p.id === product.id);
    expect(updated.name).toBe('After');
    expect(updated.sell_price).toBe(12);

    const auditRes = await request(app).get('/api/auth/audit-logs').set('Authorization', `Bearer ${ownerToken}`);
    expect(auditRes.body.some((log: any) => log.table_name === 'products' && log.record_id === product.id)).toBe(true);
  });

  it('filters by search term', async () => {
    await createProduct(app, ownerToken, { name: 'Apple Juice', sku: 'AJ-1' });
    await createProduct(app, ownerToken, { name: 'Orange Juice', sku: 'OJ-1' });

    const res = await request(app).get('/api/products?search=Apple').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Apple Juice');
  });
});
