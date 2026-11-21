import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppButton } from '../components/AppButton';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  MedicalDisclaimerBanner,
  STANDARD_MEDICAL_DISCLAIMER,
} from '../components/MedicalDisclaimerBanner';
import { StatusBadge, URGENCY_METADATA } from '../components/StatusBadge';
import {
  PHOTO_LIGHTING_GUIDE_TEXT,
  WebcamCapture,
  stopMediaStreamTracks,
} from '../components/WebcamCapture';
import apiClient, { getAuthToken } from '../services/apiClient';
import {
  clearStoredSession,
  getStoredUser,
  isAuthenticated,
  loginUser,
  registerUser,
} from '../services/authService';

describe('Komponen UI Bersama', () => {
  it('AppButton merender varian, tinggi min-h-touch, dan state loading/disabled', () => {
    const primaryHtml = renderToStaticMarkup(<AppButton variant="primary">Mulai Screening</AppButton>);
    expect(primaryHtml).toContain('Mulai Screening');
    expect(primaryHtml).toContain('bg-brand');
    expect(primaryHtml).toContain('min-h-touch');

    const loadingHtml = renderToStaticMarkup(
      <AppButton variant="danger" loading loadingText="Mengirim...">
        Hapus
      </AppButton>,
    );
    expect(loadingHtml).toContain('Mengirim...');
    expect(loadingHtml).toContain('disabled=""');
    expect(loadingHtml).toContain('aria-busy="true"');
  });

  it('StatusBadge merender warna token, simbol ikon, dan label untuk low/medium/emergency', () => {
    const lowHtml = renderToStaticMarkup(<StatusBadge urgency="low" />);
    expect(lowHtml).toContain('bg-status-green');
    expect(lowHtml).toContain(URGENCY_METADATA.low.label);

    const medHtml = renderToStaticMarkup(<StatusBadge urgency="medium" />);
    expect(medHtml).toContain('bg-status-yellow');
    expect(medHtml).toContain(URGENCY_METADATA.medium.label);

    const emgHtml = renderToStaticMarkup(<StatusBadge urgency="emergency" />);
    expect(emgHtml).toContain('bg-status-red');
    expect(emgHtml).toContain(URGENCY_METADATA.emergency.label);
  });

  it('MedicalDisclaimerBanner selalu menampilkan teks disclaimer standar non-diagnostik', () => {
    const html = renderToStaticMarkup(<MedicalDisclaimerBanner />);
    expect(html).toContain(STANDARD_MEDICAL_DISCLAIMER);
    expect(html).toContain('Disclaimer Medis');
  });

  it('ErrorBanner menerjemahkan kode galat dan merender detail validasi serta tombol Coba Lagi', () => {
    const retryHtml = renderToStaticMarkup(
      <ErrorBanner error="AI_SERVICE_UNAVAILABLE" onRetry={() => {}} />,
    );
    expect(retryHtml).toContain('Layanan analisis AI sedang sibuk');
    expect(retryHtml).toContain('Coba Lagi');

    const validationHtml = renderToStaticMarkup(
      <ErrorBanner
        error={{
          code: 'VALIDATION_ERROR',
          action: 'show_alert',
          message: 'Data belum valid.',
          fieldErrors: { email: ['Email sudah terdaftar.'] },
        }}
      />,
    );
    expect(validationHtml).toContain('Data belum valid.');
    expect(validationHtml).toContain('Email sudah terdaftar.');
  });

  it('WebcamCapture menampilkan panduan pencahayaan foto dan stopMediaStreamTracks menghentikan semua track', () => {
    const html = renderToStaticMarkup(<WebcamCapture onCapture={() => {}} />);
    expect(html).toContain(PHOTO_LIGHTING_GUIDE_TEXT);
    expect(html).toContain('Ambil Foto Gigi');
    expect(html).toContain('Ganti Kamera');

    const stopFn = vi.fn();
    const fakeStream = {
      getTracks: () => [{ stop: stopFn }, { stop: stopFn }],
    } as unknown as MediaStream;

    stopMediaStreamTracks(fakeStream);
    expect(stopFn).toHaveBeenCalledTimes(2);
  });
});

describe('Layanan & Alur Autentikasi', () => {
  beforeEach(() => {
    clearStoredSession();
    vi.restoreAllMocks();
  });

  it('registerUser menormalisasi input, memanggil POST /auth/register, dan menyimpan sesi token + user', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          token: 'jwt-register-123',
          user: {
            id: '673a1b2c3d4e5f6a7b8c9d0e',
            full_name: 'Faris Jihadi',
            email: 'faris@example.com',
            username: null,
            avatar: '',
            role: 'user',
          },
        },
      },
    });

    const response = await registerUser({
      full_name: '  Faris Jihadi ',
      email: '  FARIS@Example.com ',
      password: 'PasswordKuat123!',
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/register', {
      full_name: 'Faris Jihadi',
      email: 'faris@example.com',
      password: 'PasswordKuat123!',
    });
    expect(response.token).toBe('jwt-register-123');
    expect(getAuthToken()).toBe('jwt-register-123');
    expect(isAuthenticated()).toBe(true);
    expect(getStoredUser()?.email).toBe('faris@example.com');
  });

  it('loginUser memanggil POST /auth/login dan menyimpan sesi; clearStoredSession menghapus sesi', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          token: 'jwt-login-456',
          user: {
            id: '673a1b2c3d4e5f6a7b8c9d0e',
            full_name: 'Faris Jihadi',
            email: 'faris@example.com',
            username: null,
            avatar: '',
            role: 'user',
          },
        },
      },
    });

    await loginUser({
      email: ' FARIS@example.com ',
      password: 'PasswordKuat123!',
    });

    expect(postSpy).toHaveBeenCalledWith('/auth/login', {
      email: 'faris@example.com',
      password: 'PasswordKuat123!',
    });
    expect(getAuthToken()).toBe('jwt-login-456');

    clearStoredSession();
    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});
