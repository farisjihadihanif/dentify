import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { requestAgentChat, requestDentalPrediction } from '../src/services/aiServiceClient';
import { logger } from '../src/utils/logger';

const scan = () =>
  requestDentalPrediction({ buffer: Buffer.from('x'), filename: 'a.jpg', mimeType: 'image/jpeg' });
const chat = () => requestAgentChat({ message: 'hai', chat_history: [], knowledge_context: [] });

function mockStatus(status: number, body = '{}') {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(body, { status }));
}

describe('ai-service error classification and logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_SERVICE_TIMEOUT_MS;
  });

  for (const [name, call] of [
    ['scan', scan],
    ['chat', chat],
  ] as const) {
    it.each([502, 503, 504])(`${name}: upstream %i means the ai-service is waking`, async (status) => {
      mockStatus(status);
      await expect(call()).rejects.toMatchObject({ statusCode: 502, code: 'AI_SERVICE_UNAVAILABLE' });
    });

    it.each([401, 403])(`${name}: upstream %i is a key problem, not a cold start`, async (status) => {
      mockStatus(status);
      await expect(call()).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_AUTH_FAILED',
        message: expect.stringContaining(`HTTP ${status}`),
      });
    });

    it.each([400, 404, 429, 500])(`${name}: upstream %i is a real AI error`, async (status) => {
      mockStatus(status);
      await expect(call()).rejects.toMatchObject({
        statusCode: 502,
        code: 'AI_SERVICE_ERROR',
        message: expect.stringContaining(`HTTP ${status}`),
      });
    });

    it(`${name}: an unreadable 200 body is a real AI error`, async () => {
      mockStatus(200, '<html>');
      await expect(call()).rejects.toMatchObject({ code: 'AI_SERVICE_ERROR' });
    });

    it(`${name}: network failures count as waking`, async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(call()).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
    });
  }

  it('gives up after AI_SERVICE_TIMEOUT_MS and reports it as waking', async () => {
    process.env.AI_SERVICE_TIMEOUT_MS = '30';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    await expect(scan()).rejects.toMatchObject({ code: 'AI_SERVICE_UNAVAILABLE' });
  });

  it('waits long enough by default for a ~1 minute cold start', () => {
    process.env.AI_SERVICE_TIMEOUT_MS = ''; // a local .env may set it
    expect(getEnv().aiServiceTimeoutMs).toBe(90000);
  });

  it('logs status and duration of every AI call without the internal key', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    mockStatus(200);
    await chat();
    expect(info).toHaveBeenCalledWith('AI service call', {
      operation: 'agent_chat',
      status: 200,
      duration_ms: expect.any(Number),
    });
    mockStatus(401);
    await scan().catch(() => {});
    expect(warn).toHaveBeenCalledWith('AI service call', {
      operation: 'predict',
      status: 401,
      duration_ms: expect.any(Number),
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('fetch failed'));
    await scan().catch(() => {});
    expect(warn).toHaveBeenLastCalledWith('AI service call', {
      operation: 'predict',
      status: 'network_error',
      duration_ms: expect.any(Number),
    });
    expect(JSON.stringify([...info.mock.calls, ...warn.mock.calls])).not.toContain(
      'test-internal-key',
    );
  });

  it('health reports a key mismatch separately from an unreachable ai-service, and logs the call', async () => {
    process.env.SKIP_AI_HEALTH_IN_TEST = 'false';
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    mockStatus(401);
    const res = await request(createApp()).get('/api/v1/health');
    delete process.env.SKIP_AI_HEALTH_IN_TEST;
    expect(res.body.data.ai_service.status).toBe('auth_failed');
    expect(warn).toHaveBeenCalledWith('AI service call', {
      operation: 'health',
      status: 401,
      duration_ms: expect.any(Number),
    });
  });
});
