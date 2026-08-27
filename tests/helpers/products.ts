import request from 'supertest';
import type { Express } from 'express';

let skuCounter = 0;

export async function createProduct(
  app: Express,
  token: string,
  overrides: Partial<{
    sku: string;
    name: string;
    cost_price: number;
    sell_price: number;
    current_stock: number;
    reorder_level: number;
    has_expiry: boolean;
    expiry_date: string;
  }> = {}
) {
  skuCounter += 1;
  const product = {
    sku: `SKU-${skuCounter}`,
    name: `Product ${skuCounter}`,
    cost_price: 10,
    sell_price: 20,
    current_stock: 50,
    reorder_level: 5,
    ...overrides,
  };
  const res = await request(app).post('/api/products').set('Authorization', `Bearer ${token}`).send(product);
  if (res.status !== 200) {
    throw new Error(`Product creation failed: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.id as number, ...product };
}
