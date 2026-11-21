import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';
import ScanPage from '../app/scan/page';
import { ScanResultCard } from '../components/ScanResultCard';
import { ScanWorkspace } from '../components/ScanWorkspace';
import apiClient from '../services/apiClient';
import { submitDentalScan, type ScanReportData } from '../services/scanService';
import {
  MAX_CLIENT_FILE_SIZE_BYTES,
  validateClientImageFile,
} from '../utils/imageHelper';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

const SAMPLE_EMERGENCY_REPORT: ScanReportData = {
  id: '673a1f993d4e5f6a7b8c9d11',
  capture_source: 'camera',
  user_symptoms: 'Gigi geraham terasa nyut-nyutan',
  primary_condition: 'caries',
  condition_label: 'Indikasi Karies Gigi (Gigi Berlubang)',
  confidence_score: 0.91,
  detections: [
    {
      label: 'caries',
      confidence: 0.91,
      bbox: [120, 145, 84, 76],
    },
  ],
  urgency_level: 'emergency',
  trigger_clinic_finder: true,
  care_recommendations: {
    summary:
      'Terdeteksi indikasi karies dengan tingkat keyakinan tinggi. Disarankan segera memeriksakan diri ke dokter gigi.',
    dos: [
      'Sikat gigi lembut 2 kali sehari menggunakan pasta gigi berfluoride',
      'Berkumur dengan air hangat setelah makan untuk membersihkan sisa makanan',
    ],
    donts: [
      'Hindari makanan dan minuman terlalu manis, panas, atau dingin sementara waktu',
      'Jangan menusuk area gigi yang berlubang dengan benda tajam',
    ],
  },
  medical_disclaimer:
    'Hasil ini merupakan screening preventif berbasis AI dan bukan diagnosis medis klinis.',
  created_at: '2026-11-18T09:30:00.000Z',
};

describe('Landing Page 3 Section & Layar Pemindaian Gigi dengan Sidebar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Landing Page (/) merender tepat 3 section: Hero 3D Dunia Dentist ("Cegah kerusakan gigi sejak dini" + "Cek Sekarang!"), Alur Aplikasi, dan Preview Scan & Tanyakan ke Deni', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('data-testid="home-section-1-hero"');
    expect(html).toContain('data-testid="hero-top-left-logo"');
    expect(html).toContain('min-h-[calc(100svh-4rem)]');
    expect(html).toContain('absolute inset-0 h-full w-full');
    expect(html).toContain('data-testid="dentist-3d-canvas"');
    expect(html).toContain('Cegah Gigi Berlubang Sejak Dini');
    expect(html).toContain(
      'Dapatkan pemeriksaan gigi online gratis dan temukan solusi untuk masalah gigi Anda!',
    );
    expect(html).toContain('Cek Sekarang!');
    expect(html).toContain('href="/scan"');

    expect(html).toContain('data-testid="home-kinetic-ribbon"');
    expect(html).toContain('animate-kinetic-marquee');
    expect(html).toContain('animate-kinetic-marquee-reverse');
    expect(html).toContain('kinetic-stroke-text');

    expect(html).toContain('data-testid="home-section-2-flow"');
    expect(html).toContain('bg-surface-navy');
    expect(html).toContain('bg-surface-mint');
    expect(html).toContain('bg-surface-teal');
    expect(html).toContain('bg-surface-sand');
    expect(html).toContain('01 Unggah Foto / Kamera Langsung');
    expect(html).toContain('02 AI Menganalisis Kondisi Gigi');
    expect(html).toContain('03 Dapatkan Hasil &amp; Unduh Laporan');
    expect(html).toContain('04 Konsultasi Deni &amp; Klinik Terdekat');

    expect(html).toContain('data-testid="home-section-3-preview"');
    expect(html).toContain('Tanyakan ke Deni');
    expect(html).not.toContain('Disclaimer Medis');
  });

  it('Layar Pemindaian (/scan & ScanWorkspace) merender Sidebar Riwayat Scan ("+ Tambah Scan Baru"), panduan pencahayaan, tab kamera/galeri, dan input keluhan', () => {
    const html = renderToStaticMarkup(
      <ScanWorkspace initialHistory={[SAMPLE_EMERGENCY_REPORT]} />,
    );

    expect(html).toContain('data-testid="scan-history-sidebar"');
    expect(html).toContain('Tambah Scan Baru');
    expect(html).toContain('Buka Riwayat Scan');
    expect(html).toContain('Riwayat Scan Anda (1)');
    expect(html).toContain('Panduan Foto Akurat');
    expect(html).toContain('Pastikan pencahayaan terang');
    expect(html).toContain('Gunakan Kamera');
    expect(html).toContain('Unggah dari Galeri');
    expect(html).toContain('Keluhan Singkat (Opsional)');
    expect(html).toContain('Analisis Gambar Sekarang');

    const pageHtml = renderToStaticMarkup(<ScanPage />);
    expect(pageHtml).toContain('Pemindaian Kesehatan Gigi Mandiri');
  });

  it('validateClientImageFile memvalidasi format JPG/PNG/WEBP dan batas ukuran 5 MB', () => {
    expect(
      validateClientImageFile({
        name: 'gigi.jpg',
        type: 'image/jpeg',
        size: 120 * 1024,
      }),
    ).toEqual({ valid: true });

    const invalidType = validateClientImageFile({
      name: 'dokumen.pdf',
      type: 'application/pdf',
      size: 1024,
    });
    expect(invalidType.valid).toBe(false);
    expect(invalidType.error?.code).toBe('INVALID_IMAGE');

    const tooLarge = validateClientImageFile({
      name: 'besar.png',
      type: 'image/png',
      size: MAX_CLIENT_FILE_SIZE_BYTES + 100,
    });
    expect(tooLarge.valid).toBe(false);
    expect(tooLarge.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('ScanResultCard menampilkan kondisi, confidence %, StatusBadge, Do’s & Don’ts, disclaimer, tombol Unduh Hasil, Tanya Lebih Lanjut ke Deni, dan Cari Klinik Terdekat', () => {
    const html = renderToStaticMarkup(
      <ScanResultCard
        report={SAMPLE_EMERGENCY_REPORT}
        previewUrl="data:image/jpeg;base64,abc"
        onScanAgain={() => {}}
      />,
    );

    expect(html).toContain('Indikasi Karies Gigi (Gigi Berlubang)');
    expect(html).toContain('91%');
    expect(html).toContain('data-urgency="emergency"');
    expect(html).toContain('Yang Dianjurkan (Do&#x27;s)');
    expect(html).toContain('Yang Harus Dihindari (Don&#x27;ts)');
    expect(html).toContain('data-testid="download-scan-result-btn"');
    expect(html).toContain('Unduh Hasil');
    expect(html).toContain('Tanya Deni Lebih Lanjut');
    expect(html).toContain('Cari Klinik Terdekat');
    expect(html).toContain('data-testid="clinic-finder-escalation-card"');
  });

  it('submitDentalScan mengirim FormData ke POST /scans dan mengembalikan ScanReportData', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: SAMPLE_EMERGENCY_REPORT,
      },
    });

    const dummyFile = new File(['dummy'], 'tooth.jpg', { type: 'image/jpeg' });
    const result = await submitDentalScan({
      image: dummyFile,
      captureSource: 'camera',
      userSymptoms: 'Ngilu saat minum dingin',
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [endpoint, body] = postSpy.mock.calls[0];
    expect(endpoint).toBe('/scans');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('capture_source')).toBe('camera');
    expect((body as FormData).get('user_symptoms')).toBe('Ngilu saat minum dingin');
    expect(result.id).toBe(SAMPLE_EMERGENCY_REPORT.id);
    expect(result.trigger_clinic_finder).toBe(true);
  });
});
