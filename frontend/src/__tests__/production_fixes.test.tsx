import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeniChat } from '../components/DeniChat';
import { ErrorBanner } from '../components/ErrorBanner';
import { ScanWorkspace } from '../components/ScanWorkspace';
import apiClient from '../services/apiClient';
import { AI_REQUEST_TIMEOUT_MS } from '../services/apiClient';
import { sendDeniMessage } from '../services/chatService';
import { isServerWakingError, mapApiError } from '../services/errorMapper';
import { submitDentalScan } from '../services/scanService';
import { buildCameraConstraints, isMobileDevice, supportsTorch } from '../utils/cameraSupport';
import {
  MAX_CLIENT_FILE_SIZE_BYTES,
  MAX_UPLOAD_IMAGE_BYTES,
  encodeUnderLimit,
  prepareImageForUpload,
  validateClientImageFile,
} from '../utils/imageHelper';

const MB = 1024 * 1024;
const blobOf = (size: number) => ({ size }) as Blob;

describe('Uploads: compressed under 3 MB before sending', () => {
  it('accepts a large phone photo, because it is compressed before upload', () => {
    expect(MAX_UPLOAD_IMAGE_BYTES).toBe(3 * MB);
    expect(MAX_CLIENT_FILE_SIZE_BYTES).toBeGreaterThanOrEqual(20 * MB);
    expect(validateClientImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 12 * MB }).valid).toBe(
      true,
    );
  });

  it('downscales to at most 2048 px on the long side at high quality first', async () => {
    const encode = vi.fn(async () => blobOf(1 * MB));
    const blob = await encodeUnderLimit(4000, 3000, encode);
    expect(blob?.size).toBe(1 * MB);
    expect(encode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledWith(2048, 1536, 0.92);
  });

  it('never upscales a small photo', async () => {
    const encode = vi.fn(async () => blobOf(10));
    await encodeUnderLimit(640, 480, encode);
    expect(encode).toHaveBeenCalledWith(640, 480, 0.92);
  });

  it('lowers quality, then size, until it fits, keeping at least 1024 px', async () => {
    const seen: number[] = [];
    const blob = await encodeUnderLimit(4000, 3000, async (w, _h, q) => {
      seen.push(w);
      return blobOf(w < 1400 && q < 0.9 ? 2 * MB : 5 * MB);
    });
    expect(blob?.size).toBe(2 * MB);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1024);
  });

  it('returns null when nothing fits', async () => {
    expect(await encodeUnderLimit(4000, 3000, async () => blobOf(9 * MB))).toBeNull();
  });

  it('rejects a photo that is still too big with a clear message', async () => {
    const file = new File([new Uint8Array(3 * MB + 1)], 'besar.jpg', { type: 'image/jpeg' });
    await expect(prepareImageForUpload(file)).rejects.toMatchObject({
      uiError: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Ukuran foto masih di atas 3 MB setelah dikompres. Silakan pilih atau ambil foto lain.',
      },
    });
  });
});

describe('Errors: waking only for cold starts, otherwise the real error and its code', () => {
  it.each(['AI_AUTH_FAILED', 'AI_SERVICE_ERROR', 'SERVER_NOT_READY'])(
    '%s shows the backend message and is not a cold start',
    (code) => {
      const mapped = mapApiError({ response: { status: 502, data: { code, message: 'Pesan asli' } } });
      expect(mapped).toMatchObject({ code, message: 'Pesan asli', httpStatus: 502 });
      expect(isServerWakingError(mapped)).toBe(false);
    },
  );

  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'UNKNOWN_ERROR'],
    [500, 'INTERNAL_ERROR'],
  ])('a bare HTTP %i maps to %s, not waking', (status, code) => {
    const mapped = mapApiError({ response: { status } });
    expect(mapped).toMatchObject({ code, httpStatus: status });
    expect(isServerWakingError(mapped)).toBe(false);
  });

  it.each([502, 503])('a bare %i from the backend host is not the ai-service waking', (status) => {
    expect(isServerWakingError(mapApiError({ response: { status } }))).toBe(false);
  });

  it('shows the code in the banner', () => {
    expect(
      renderToStaticMarkup(<ErrorBanner error={mapApiError({ response: { status: 403 } })} />),
    ).toContain('Kode: FORBIDDEN (HTTP 403)');
    const ai = mapApiError({ code: 'AI_AUTH_FAILED', message: 'Kunci ditolak (HTTP 401).' });
    const html = renderToStaticMarkup(<ErrorBanner error={ai} />);
    expect(html).toContain('Kunci ditolak (HTTP 401).');
    expect(html).toContain('Kode: AI_AUTH_FAILED');
    expect(html).not.toContain('Server sedang dinyalakan');
  });
});

describe('AI requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wait longer than the backend does for a cold ai-service, and send a chat photo once', async () => {
    expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThan(90000);
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { data: {} } });
    await sendDeniMessage({ message: 'hai', imageBase64: 'data:image/jpeg;base64,AA' });
    expect(post).toHaveBeenLastCalledWith(
      '/chat',
      { message: 'hai', image_data_url: 'data:image/jpeg;base64,AA' },
      { timeout: AI_REQUEST_TIMEOUT_MS },
    );
    await submitDentalScan({
      image: new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
      captureSource: 'camera',
    });
    expect(post).toHaveBeenLastCalledWith('/scans', expect.any(FormData), {
      timeout: AI_REQUEST_TIMEOUT_MS,
    });
  });
});

describe('Camera', () => {
  it('uses the native camera on phones and tablets only', () => {
    expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile' })).toBe(true);
    expect(isMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(
      true,
    );
    // iPadOS reports a Mac user agent
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    expect(isMobileDevice({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
    expect(isMobileDevice({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
    // Touch-screen Windows laptop
    expect(
      isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 10 }),
    ).toBe(false);
  });

  it('asks for the highest resolution available', () => {
    expect(buildCameraConstraints('environment')).toEqual({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      },
      audio: false,
    });
  });

  it('detects torch support without throwing on browsers that lack getCapabilities', () => {
    expect(supportsTorch({ getCapabilities: () => ({ torch: true }) })).toBe(true);
    expect(supportsTorch({ getCapabilities: () => ({}) })).toBe(false);
    expect(supportsTorch({})).toBe(false);
    expect(supportsTorch(null)).toBe(false);
  });

  it('renders a native capture input for the rear camera', () => {
    const html = renderToStaticMarkup(<ScanWorkspace />);
    const input = html.match(/<input[^>]*data-testid="native-camera-input"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('type="file"');
    expect(input).toContain('accept="image/*"');
    expect(input).toContain('capture="environment"');
  });
});

describe('Mobile chat', () => {
  it('has a growing textarea composer and an off-canvas drawer that is inert when closed', () => {
    const html = renderToStaticMarkup(<DeniChat initialSessions={[]} />);
    const textarea = html.match(/<textarea[^>]*id="deni-message-input"[^>]*>/)?.[0] ?? '';
    expect(textarea).toContain('rows="1"');
    expect(textarea).toContain('placeholder="Tanya Deni..."');
    const aside = html.match(/<aside[^>]*data-testid="deni-sessions-sidebar"[^>]*>/)?.[0] ?? '';
    expect(aside).toContain('-translate-x-full');
    expect(aside).toContain('invisible');
  });
});
