import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models';
import { optionalAuthMiddleware } from '../src/middlewares/authMiddleware';
import { errorHandler } from '../src/middlewares/errorHandler';
import type { AuthenticatedRequest } from '../src/middlewares/rateLimiter';
import { setupTestDb, clearTestDb, teardownTestDb } from './helpers/testDb';

describe('Auth endpoints & middlewares', () => {
  beforeAll(async () => {
    await setupTestDb();
    await User.syncIndexes();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('POST /auth/register forces role: "user", hashes password, rejects duplicate email with 422', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      full_name: 'Faris Jihadi',
      email: 'faris@example.com',
      password: 'PasswordKuat123!',
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.user).toMatchObject({
      full_name: 'Faris Jihadi',
      email: 'faris@example.com',
      username: null,
      avatar: '',
      role: 'user',
    });
    expect(res.body.data.user).not.toHaveProperty('password_hash');

    // Duplicate email -> 422 VALIDATION_ERROR on email
    const dup = await request(app).post('/api/v1/auth/register').send({
      full_name: 'Another User',
      email: 'faris@example.com',
      password: 'PasswordKuat123!',
    });
    expect(dup.status).toBe(422);
    expect(dup.body.code).toBe('VALIDATION_ERROR');
    expect(dup.body.errors).toHaveProperty('email');
  });

  it('POST /auth/login returns token on valid creds and generic 401 on wrong email or password', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/register').send({
      full_name: 'Faris Login',
      email: 'login@example.com',
      password: 'PasswordKuat123!',
    });

    const ok = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com',
      password: 'PasswordKuat123!',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(typeof ok.body.data.token).toBe('string');

    const badPass = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com',
      password: 'WrongPassword123!',
    });
    expect(badPass.status).toBe(401);
    expect(badPass.body.code).toBe('UNAUTHENTICATED');
    expect(badPass.body.message).toBe('Email atau password salah.');

    const badEmail = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'PasswordKuat123!',
    });
    expect(badEmail.status).toBe(401);
    expect(badEmail.body.code).toBe('UNAUTHENTICATED');
    expect(badEmail.body.message).toBe('Email atau password salah.');
  });

  it('GET /auth/me requires valid JWT and optionalAuthMiddleware rejects invalid token with 401', async () => {
    const app = createApp();
    const reg = await request(app).post('/api/v1/auth/register').send({
      full_name: 'Faris Me',
      email: 'me@example.com',
      password: 'PasswordKuat123!',
    });
    const token = reg.body.data.token as string;

    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('me@example.com');

    // Optional auth test harness
    const optApp = express();
    optApp.get('/opt', optionalAuthMiddleware, (req: AuthenticatedRequest, res) => {
      res.json({ guest: !req.user, userId: req.user?.id ?? null });
    });
    optApp.use(errorHandler);

    const guestRes = await request(optApp).get('/opt');
    expect(guestRes.status).toBe(200);
    expect(guestRes.body.guest).toBe(true);

    const invalidOptRes = await request(optApp)
      .get('/opt')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(invalidOptRes.status).toBe(401);
    expect(invalidOptRes.body.code).toBe('UNAUTHENTICATED');
  });

  it('PUT /auth/me updates full_name (and name alias), unique username, avatar, and password', async () => {
    const app = createApp();
    const r1 = await request(app).post('/api/v1/auth/register').send({
      full_name: 'User Satu',
      email: 'u1@example.com',
      password: 'OldPassword123!',
    });
    const r2 = await request(app).post('/api/v1/auth/register').send({
      full_name: 'User Dua',
      email: 'u2@example.com',
      password: 'OldPassword123!',
    });
    const token1 = r1.body.data.token as string;
    const token2 = r2.body.data.token as string;

    // Update name via alias, username, and avatar
    const upd1 = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'Faris Jihadi Hanif Lubis',
        username: 'farislubis',
        avatar: 'data:image/png;base64,iVBORw0KGgo=',
      });
    expect(upd1.status).toBe(200);
    expect(upd1.body.message).toBe('Profil berhasil diperbarui.');
    expect(upd1.body.data.user.full_name).toBe('Faris Jihadi Hanif Lubis');
    expect(upd1.body.data.user.username).toBe('farislubis');
    expect(upd1.body.data.user.avatar).toBe('data:image/png;base64,iVBORw0KGgo=');

    // Username conflict -> 422 on username
    const conflict = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token2}`)
      .send({ username: 'farislubis' });
    expect(conflict.status).toBe(422);
    expect(conflict.body.errors).toHaveProperty('username');

    // Wrong current_password -> 422 on current_password
    const wrongPw = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ current_password: 'WrongOldPassword!', new_password: 'NewPassword456!' });
    expect(wrongPw.status).toBe(422);
    expect(wrongPw.body.errors).toHaveProperty('current_password');

    // Valid password change
    const okPw = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({ current_password: 'OldPassword123!', new_password: 'NewPassword456!' });
    expect(okPw.status).toBe(200);

    // Verify new password works on login
    const relogin = await request(app).post('/api/v1/auth/login').send({
      email: 'u1@example.com',
      password: 'NewPassword456!',
    });
    expect(relogin.status).toBe(200);
  });
});
