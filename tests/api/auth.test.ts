import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { freshApp } from '../helpers/testApp';
import { createUser, setupOwner } from '../helpers/auth';

let app: Express;

beforeEach(async () => {
  app = await freshApp();
});

describe('setup', () => {
  it('creates the first owner account', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ name: 'Owner', username: 'owner', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('refuses to run setup twice', async () => {
    await setupOwner(app);
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ name: 'Second Owner', username: 'owner2', password: 'pass1234' });
    expect(res.status).toBe(400);
  });

  it('flips needsSetup to false once an owner exists', async () => {
    await setupOwner(app);
    const res = await request(app).get('/api/auth/check-setup');
    expect(res.body.needsSetup).toBe(false);
  });
});

describe('login', () => {
  it('logs in with correct credentials and returns a token + user', async () => {
    await setupOwner(app);
    const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'pass1234' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ username: 'owner', role: 'owner' });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    await setupOwner(app);
    const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent username', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('locks out after too many failed attempts', async () => {
    await setupOwner(app);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'wrong' });
      expect(res.status).toBe(401);
    }
    // 6th attempt is locked out even with the correct password.
    const res = await request(app).post('/api/auth/login').send({ username: 'owner', password: 'pass1234' });
    expect(res.status).toBe(429);
  });
});

describe('authenticateToken', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/users');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/api/auth/users').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a token belonging to a since-disabled user', async () => {
    const { token: ownerToken } = await setupOwner(app);
    const employee = await createUser(app, ownerToken);

    // The employee's token is valid until the owner disables the account.
    const before = await request(app).get('/api/categories').set('Authorization', `Bearer ${employee.token}`);
    expect(before.status).toBe(200);

    await request(app)
      .put(`/api/auth/users/${employee.user.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ is_active: 0 });

    const after = await request(app).get('/api/categories').set('Authorization', `Bearer ${employee.token}`);
    expect(after.status).toBe(401);
  });
});

describe('requireOwner', () => {
  it('blocks an employee from an owner-only route with 403, not 401', async () => {
    const { token: ownerToken } = await setupOwner(app);
    const employee = await createUser(app, ownerToken);

    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${employee.token}`);
    expect(res.status).toBe(403);
  });

  it('allows the owner through', async () => {
    const { token } = await setupOwner(app);
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('user management', () => {
  it('rejects a duplicate username', async () => {
    const { token } = await setupOwner(app);
    await createUser(app, token, { username: 'dup' });
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another', username: 'dup', password: 'pass1234', role: 'employee' });
    expect(res.status).toBe(400);
  });

  it('cannot disable the last active owner', async () => {
    const { token, user } = await setupOwner(app);
    const res = await request(app)
      .put(`/api/auth/users/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: 0 });
    expect(res.status).toBe(400);
  });

  it('can disable an owner once a second active owner exists', async () => {
    const { token, user } = await setupOwner(app);
    const secondOwner = await createUser(app, token, { username: 'owner2', role: 'owner' });

    const res = await request(app)
      .put(`/api/auth/users/${user.id}/status`)
      .set('Authorization', `Bearer ${secondOwner.token}`)
      .send({ is_active: 0 });
    expect(res.status).toBe(200);
  });

  it('resets a password and invalidates the old one', async () => {
    const { token } = await setupOwner(app);
    const employee = await createUser(app, token);

    await request(app)
      .put(`/api/auth/users/${employee.user.id}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'new-password-1' });

    const oldLogin = await request(app).post('/api/auth/login').send({ username: employee.credentials.username, password: employee.credentials.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post('/api/auth/login').send({ username: employee.credentials.username, password: 'new-password-1' });
    expect(newLogin.status).toBe(200);
  });
});
