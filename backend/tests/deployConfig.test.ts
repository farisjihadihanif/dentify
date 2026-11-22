import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  assertProductionEnv,
  findProductionEnvProblems,
  isOriginAllowed,
} from '../src/config/env';

const validProd = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb+srv://cluster.example.mongodb.net/dentify',
  JWT_SECRET: 'x'.repeat(48),
  CORS_ORIGINS: 'https://dentify.vercel.app',
  AI_SERVICE_URL: 'https://dentify-ai-service.onrender.com',
  AI_SERVICE_API_KEY: 'k'.repeat(40),
};

describe('Deploy configuration', () => {
  it('GET /healthz answers without calling the ai-service', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await request(createApp()).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'alive' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('accepts a complete production environment', () => {
    expect(findProductionEnvProblems(validProd)).toEqual([]);
    expect(() => assertProductionEnv(validProd)).not.toThrow();
  });

  it('refuses to start in production with missing or development values', () => {
    const problems = findProductionEnvProblems({
      NODE_ENV: 'production',
      JWT_SECRET: 'short',
      CORS_ORIGINS: 'http://localhost:3000',
      AI_SERVICE_URL: 'http://localhost:8000',
      AI_SERVICE_API_KEY: 'dev-internal-key',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'MONGODB_URI is not set',
        'JWT_SECRET must be a random value of at least 32 characters',
        'AI_SERVICE_API_KEY must not be the development key',
        'AI_SERVICE_URL points to localhost',
        'CORS_ORIGINS points to localhost',
      ]),
    );
    expect(() => assertProductionEnv({ NODE_ENV: 'production' })).toThrow(/MONGODB_URI/);
    // Outside production the local defaults stay usable
    expect(() => assertProductionEnv({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('matches exact CORS origins and * patterns for Vercel previews only', () => {
    const allowed = ['https://dentify.vercel.app', 'https://dentify-*.vercel.app'];
    expect(isOriginAllowed('https://dentify.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://dentify-git-main-team.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://evil.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://dentify-x.vercel.app.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('https://a.b.dentify-x.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('http://dentify.vercel.app', allowed)).toBe(false);
  });
});
