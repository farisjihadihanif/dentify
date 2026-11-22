import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../src/app';
import { errorHandler } from '../src/middlewares/errorHandler';
import { validateBody } from '../src/middlewares/validate';
import { createRateLimiter } from '../src/middlewares/rateLimiter';
import { ApiError } from '../src/utils/ApiError';

describe('Foundation: health, error shape, validation, rate limiter', () => {
  it('GET /api/v1/health returns success envelope with service status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.service).toBe('dentify-backend');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('ai_service');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('unknown route returns 404 NOT_FOUND in canonical error format without errors field', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Endpoint tidak ditemukan.',
      code: 'NOT_FOUND',
    });
    expect(res.body).not.toHaveProperty('errors');
  });

  it('Zod validation middleware returns 422 VALIDATION_ERROR with errors map', async () => {
    const testApp = express();
    testApp.use(express.json());
    const schema = z.object({
      email: z.string().email('Email tidak valid.'),
    });
    testApp.post('/test-validate', validateBody(schema), (_req, res) => {
      res.json({ success: true });
    });
    testApp.use(errorHandler);

    const res = await request(testApp).post('/test-validate').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toHaveProperty('email');
  });

  it('rate limiter returns 429 RATE_LIMITED in canonical error shape', async () => {
    const testApp = express();
    testApp.use('/limited', createRateLimiter({ max: 2, windowMs: 60_000 }));
    testApp.get('/limited', (_req, res) => res.json({ success: true }));

    expect((await request(testApp).get('/limited')).status).toBe(200);
    expect((await request(testApp).get('/limited')).status).toBe(200);

    const third = await request(testApp).get('/limited');
    expect(third.status).toBe(429);
    expect(third.body.success).toBe(false);
    expect(third.body.code).toBe('RATE_LIMITED');
    expect(typeof third.body.message).toBe('string');
  });

  it('ApiError without errors omits errors key, and unknown errors return 500 INTERNAL_ERROR', async () => {
    const testApp = express();
    testApp.get('/api-err', (_req, _res, next) =>
      next(new ApiError(400, 'BAD_REQUEST', 'Permintaan salah.')),
    );
    testApp.get('/boom', () => {
      throw new Error('sensitive db stack');
    });
    testApp.use(errorHandler);

    const r1 = await request(testApp).get('/api-err');
    expect(r1.status).toBe(400);
    expect(r1.body).toEqual({
      success: false,
      message: 'Permintaan salah.',
      code: 'BAD_REQUEST',
    });

    const r2 = await request(testApp).get('/boom');
    expect(r2.status).toBe(500);
    expect(r2.body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(r2.body)).not.toContain('sensitive db stack');
  });
});
