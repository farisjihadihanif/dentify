import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from '../components/ErrorBanner';
import { ServerWakingNotice } from '../components/ServerWakingNotice';
import { isServerWakingError, mapApiError } from '../services/errorMapper';
import { checkServerStatus, warmUpServers } from '../services/serverStatus';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('Cold start: server sedang dinyalakan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps timeouts, no-response network errors and platform 504 to SERVER_WAKING', () => {
    expect(mapApiError({ code: 'ECONNABORTED' }).code).toBe('SERVER_WAKING');
    expect(mapApiError({ code: 'ETIMEDOUT' }).code).toBe('SERVER_WAKING');
    expect(mapApiError({ code: 'ERR_NETWORK' }).code).toBe('SERVER_WAKING');
    expect(mapApiError({ response: { status: 504 } }).code).toBe('SERVER_WAKING');
    expect(mapApiError({ code: 'ECONNABORTED' }).message).toBe(
      'Server sedang dinyalakan, tunggu sekitar 1 menit, lalu coba lagi.',
    );
  });

  it('keeps NETWORK_ERROR when the browser is offline, and real backend codes unchanged', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(mapApiError({ code: 'ERR_NETWORK' }).code).toBe('NETWORK_ERROR');
    expect(
      mapApiError({ response: { status: 502, data: { code: 'AI_SERVICE_UNAVAILABLE' } } }).code,
    ).toBe('AI_SERVICE_UNAVAILABLE');
    expect(mapApiError({ response: { status: 500, data: { code: 'INTERNAL_ERROR' } } }).code).toBe(
      'INTERNAL_ERROR',
    );
  });

  it('treats SERVER_WAKING and AI_SERVICE_UNAVAILABLE as waking, other errors not', () => {
    expect(isServerWakingError({ code: 'SERVER_WAKING' })).toBe(true);
    expect(isServerWakingError({ code: 'AI_SERVICE_UNAVAILABLE' })).toBe(true);
    expect(isServerWakingError({ code: 'NOT_DENTAL_IMAGE' })).toBe(false);
    expect(isServerWakingError({ code: 'NETWORK_ERROR' })).toBe(false);
  });

  it('ErrorBanner shows the calm waking notice with retry instead of a red alert', () => {
    const html = renderToStaticMarkup(
      <ErrorBanner error={mapApiError({ code: 'ECONNABORTED' })} onRetry={() => {}} />,
    );
    expect(html).toContain('Server sedang dinyalakan');
    expect(html).toContain('tunggu sekitar 1 menit');
    expect(html).toContain('Coba Lagi');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('bg-status-red');
  });

  it('ServerWakingNotice starts in the waking state with a countdown and progress bar', () => {
    const html = renderToStaticMarkup(
      <ServerWakingNotice checkStatus={async () => 'waking'} onDismiss={() => {}} />,
    );
    expect(html).toContain('data-server-status="waking"');
    expect(html).toContain('Perkiraan sekitar 60 detik lagi');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Tutup');
    // No retry button without a retry handler
    expect(html).not.toContain('Coba Lagi');
  });

  it('checkServerStatus is ready only when the database and the ai-service model are up', async () => {
    const fetchImpl = vi.fn();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ data: { database: 'connected', ai_service: { status: 'ok' } } }),
    );
    expect(await checkServerStatus('https://api.example.com/api/v1', 1000, fetchImpl)).toBe('ready');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/health',
      expect.objectContaining({ cache: 'no-store' }),
    );

    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ data: { database: 'connected', ai_service: { status: 'unavailable' } } }),
    );
    expect(await checkServerStatus('https://x/api/v1', 1000, fetchImpl)).toBe('waking');

    fetchImpl.mockResolvedValueOnce(jsonResponse({}, false));
    expect(await checkServerStatus('https://x/api/v1', 1000, fetchImpl)).toBe('waking');

    fetchImpl.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await checkServerStatus('https://x/api/v1', 1000, fetchImpl)).toBe('waking');
  });

  it('warmUpServers pings at most once per 10 minutes per tab', () => {
    const store = new Map<string, string>();
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    const t0 = 1_800_000_000_000;
    expect(warmUpServers(t0)).toBe(true);
    expect(warmUpServers(t0 + 60_000)).toBe(false);
    expect(warmUpServers(t0 + 11 * 60_000)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
