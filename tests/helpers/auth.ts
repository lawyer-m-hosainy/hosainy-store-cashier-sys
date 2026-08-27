import request from 'supertest';
import type { Express } from 'express';

export async function setupOwner(app: Express, overrides: Partial<{ name: string; username: string; password: string }> = {}) {
  const owner = { name: 'Test Owner', username: 'owner', password: 'pass1234', ...overrides };
  const setupRes = await request(app).post('/api/auth/setup').send(owner);
  if (setupRes.status !== 200) {
    throw new Error(`Owner setup failed: ${JSON.stringify(setupRes.body)}`);
  }
  const loginRes = await request(app).post('/api/auth/login').send({ username: owner.username, password: owner.password });
  return { token: loginRes.body.token as string, user: loginRes.body.user, credentials: owner };
}

export async function createUser(
  app: Express,
  ownerToken: string,
  overrides: Partial<{ name: string; username: string; password: string; role: string }> = {}
) {
  const account = { name: 'Employee', username: 'emp1', password: 'pass1234', role: 'employee', ...overrides };
  const createRes = await request(app).post('/api/auth/users').set('Authorization', `Bearer ${ownerToken}`).send(account);
  if (createRes.status !== 200) {
    throw new Error(`User creation failed: ${JSON.stringify(createRes.body)}`);
  }
  const loginRes = await request(app).post('/api/auth/login').send({ username: account.username, password: account.password });
  return { token: loginRes.body.token as string, user: loginRes.body.user, credentials: account };
}
