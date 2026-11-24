import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { attachAuthInterceptor, resolveApiBaseUrl } from '../services/apiClient';
import { clearAuthToken, getAuthToken, hasAuthToken, setAuthToken } from '../services/authStorage';
import { mapApiError } from '../services/errorMapper';

describe('errorMapper', () => {
  it('maps core API error codes to exact Indonesian messages and UI actions', () => {
    expect(mapApiError('UNAUTHENTICATED')).toEqual({
      code: 'UNAUTHENTICATED',
      action: 'redirect_login',
      message: 'Sesi Anda telah berakhir. Silakan masuk kembali untuk mengakses riwayat Anda.',
    });

    expect(mapApiError('PAYLOAD_TOO_LARGE')).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      action: 'reset_file_input',
      message: 'Ukuran foto terlalu besar (maksimal 3 MB setelah dikompres). Silakan pilih foto lain.',
    });

    expect(mapApiError('INVALID_IMAGE')).toEqual({
      code: 'INVALID_IMAGE',
      action: 'reset_file_input',
      message: 'Format file tidak didukung. Gunakan foto berformat JPG, PNG, atau WEBP.',
    });

    expect(mapApiError('LOW_QUALITY_IMAGE')).toEqual({
      code: 'LOW_QUALITY_IMAGE',
      action: 'show_retake_guidance',
      message:
        'Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.',
    });

    expect(mapApiError('NOT_DENTAL_IMAGE')).toEqual({
      code: 'NOT_DENTAL_IMAGE',
      title: 'Bukan Foto Gigi yang Valid',
      action: 'show_retake_guidance',
      message:
        'Foto yang diunggah bukan foto gigi atau rongga mulut. Unggah foto close-up area gigi dan gusi yang terlihat jelas untuk memulai pemindaian.',
    });

    expect(mapApiError('RATE_LIMITED')).toEqual({
      code: 'RATE_LIMITED',
      action: 'cooldown_submit_10s',
      cooldownSeconds: 10,
      message: 'Permintaan terlalu cepat. Mohon tunggu sebentar sebelum mencoba lagi.',
    });

    expect(mapApiError('AI_SERVICE_UNAVAILABLE')).toEqual({
      code: 'AI_SERVICE_UNAVAILABLE',
      action: 'show_retry_button',
      message: 'Layanan analisis AI sedang sibuk. Silakan kirim ulang foto Anda.',
    });

    expect(mapApiError({ code: 1 })).toEqual({
      code: 'GEOLOCATION_DENIED',
      action: 'show_manual_location_form',
      message:
        'Akses lokasi dinonaktifkan. Masukkan nama kota atau kecamatan Anda untuk mencari klinik terdekat.',
    });
  });

  it('maps Axios error payloads including fieldErrors on 422 VALIDATION_ERROR', () => {
    const mapped = mapApiError({
      response: {
        status: 422,
        data: {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Format email tidak valid.',
          errors: { email: ['Format email tidak valid.'] },
        },
      },
    });

    expect(mapped).toEqual({
      code: 'VALIDATION_ERROR',
      action: 'show_alert',
      cooldownSeconds: undefined,
      message: 'Format email tidak valid.',
      fieldErrors: { email: ['Format email tidak valid.'] },
      httpStatus: 422,
    });

    const notDentalMapped = mapApiError({
      response: {
        status: 422,
        data: {
          success: false,
          code: 'NOT_DENTAL_IMAGE',
          message:
            'Foto yang diunggah bukan foto gigi atau rongga mulut. Unggah foto gigi yang terlihat jelas untuk memulai pemindaian.',
        },
      },
    });

    expect(notDentalMapped).toMatchObject({
      code: 'NOT_DENTAL_IMAGE',
      title: 'Bukan Foto Gigi yang Valid',
      action: 'show_retake_guidance',
    });
    expect(notDentalMapped.message).toContain('gigi');
  });
});

describe('apiClient and authStorage', () => {
  beforeEach(() => {
    clearAuthToken();
  });

  it('resolves NEXT_PUBLIC_API_URL and trims trailing slashes', () => {
    expect(resolveApiBaseUrl({ NEXT_PUBLIC_API_URL: 'https://api.dentify.id/api/v1///' })).toBe(
      'https://api.dentify.id/api/v1',
    );
    expect(resolveApiBaseUrl({})).toBe('http://localhost:5000/api/v1');
  });

  it('stores token via authStorage and injects Authorization Bearer header', () => {
    expect(hasAuthToken()).toBe(false);
    setAuthToken('jwt-token-contoh');
    expect(getAuthToken()).toBe('jwt-token-contoh');
    expect(hasAuthToken()).toBe(true);

    const config = attachAuthInterceptor({
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig);

    expect(config.headers.get('Authorization')).toBe('Bearer jwt-token-contoh');
    expect(config.headers.get('Accept')).toBe('application/json');
  });
});
