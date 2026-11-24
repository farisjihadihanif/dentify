import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createReadiness } from '../src/serverless';
import { getEnv } from '../src/config/env';
import { logger } from '../src/utils/logger';

describe('Vercel serverless entry', () => {
  afterEach(() => {
    delete process.env.VERCEL;
    vi.restoreAllMocks();
  });

  it('opens one Mongo connection for concurrent requests and reuses it', async () => {
    const connect = vi.fn(async () => {});
    const ready = createReadiness({ connect, assertEnv: () => {}, isDisconnected: () => false });
    await Promise.all([ready(), ready()]);
    await ready();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('retries on the next request after a failed connection', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const connect = vi.fn(async () => {}).mockRejectedValueOnce(new Error('no mongo'));
    const ready = createReadiness({ connect, assertEnv: () => {}, isDisconnected: () => false });
    await expect(ready()).rejects.toMatchObject({ statusCode: 503, code: 'SERVER_NOT_READY' });
    await ready();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects when the cached connection was dropped', async () => {
    const connect = vi.fn(async () => {});
    const ready = createReadiness({ connect, assertEnv: () => {}, isDisconnected: () => true });
    await ready();
    await ready();
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('answers a readable CORS 503 when not ready, but keeps /healthz alive', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    const ready = createReadiness({
      connect: async () => {},
      assertEnv: () => {
        throw new Error('JWT_SECRET is not set');
      },
      isDisconnected: () => true,
    });
    const app = createApp({ ready });
    const res = await request(app).get('/api/v1/articles').set('Origin', 'http://localhost:3000');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVER_NOT_READY');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.stringify(res.body)).not.toContain('JWT_SECRET');
    expect((await request(app).get('/healthz')).status).toBe(200);
  });

  it('trusts one proxy hop by default on Vercel', () => {
    process.env.VERCEL = '1';
    process.env.TRUST_PROXY = ''; // a local .env may set it
    expect(getEnv().trustProxy).toBe(1);
  });

  it('vercel.json sends everything to the function and outlives the AI timeout', () => {
    const root = path.join(__dirname, '..');
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    expect(config.framework).toBeNull();
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/api/index' }]);
    const fn = config.functions['api/index.js'];
    expect(fn.includeFiles).toBe('dist/**');
    expect(fn.maxDuration * 1000).toBeGreaterThanOrEqual(getEnv().aiServiceTimeoutMs + 20000);
    expect(fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf8')).toContain('Disallow: /');
  });
});
