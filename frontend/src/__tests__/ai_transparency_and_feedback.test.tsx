import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiFeedbackControl } from '../components/AiFeedbackControl';
import { AppFooter } from '../components/AppFooter';
import { DeniChat, FALLBACK_DENI_BANNER_TEXT } from '../components/DeniChat';
import { DeniMascot } from '../components/DeniMascot';
import { FloatingNavbar } from '../components/FloatingNavbar';
import {
  LOW_CONFIDENCE_WARNING_TEXT,
  ScanResultCard,
} from '../components/ScanResultCard';
import apiClient from '../services/apiClient';
import { submitAiFeedback } from '../services/feedbackService';
import type { ScanReportData } from '../services/scanService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/scan',
}));

function makeScanReport(confidenceScore: number): ScanReportData {
  return {
    id: 'scan_t207_001',
    capture_source: 'upload',
    primary_condition: 'caries',
    condition_label: 'Indikasi Karies Gigi',
    confidence_score: confidenceScore,
    urgency_level: confidenceScore < 0.75 ? 'medium' : 'high',
    trigger_clinic_finder: confidenceScore >= 0.75,
    detections: [{ label: 'caries', confidence: confidenceScore, bbox: [0.1, 0.2, 0.4, 0.5] }],
    care_recommendations: {
      summary: 'Terdeteksi indikasi awal karies gigi pada foto yang diunggah.',
      dos: ['Sikat gigi dua kali sehari dengan pasta gigi berfluoride.'],
      donts: ['Hindari minuman manis berlebihan sebelum tidur.'],
    },
    medical_disclaimer:
      'Hasil ini merupakan skrining awal berbasis AI dan bukan diagnosis medis resmi.',
    created_at: '2026-11-20T12:00:00.000Z',
  };
}

describe('AI transparency labels, honest confidence, fallback banner, and feedback control', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Hasil analisis AI" and feedback controls on ScanResultCard without low-confidence warning when >= 0.75', () => {
    const html = renderToStaticMarkup(<ScanResultCard report={makeScanReport(0.88)} />);
    expect(html).toContain('Hasil analisis AI');
    expect(html).toContain('88%');
    expect(html).not.toContain(LOW_CONFIDENCE_WARNING_TEXT);
    expect(html).toContain('Membantu');
    expect(html).toContain('Tidak akurat');
  });

  it('shows a weak-indication note but no unsure warning between the threshold and 0.75', () => {
    const html = renderToStaticMarkup(<ScanResultCard report={makeScanReport(0.62)} />);
    expect(html).toContain('62%');
    expect(html).toContain('Indikasi visual masih lemah');
    expect(html).not.toContain(LOW_CONFIDENCE_WARNING_TEXT);
  });

  it('shows the unsure retake result instead of a condition when is_low_confidence is set', () => {
    const report = {
      ...makeScanReport(0.52),
      is_low_confidence: true,
      condition_label: 'Hasil Belum Meyakinkan – Silakan Ambil Ulang Foto',
    };
    const html = renderToStaticMarkup(<ScanResultCard report={report} onScanAgain={() => {}} />);
    expect(html).toContain(LOW_CONFIDENCE_WARNING_TEXT);
    expect(html).toContain('Hasil Belum Meyakinkan');
    expect(html).toContain('data-testid="low-confidence-cta-retake"');
    expect(html).not.toContain('52%');
    expect(html).not.toContain('Indikasi Karies');
    expect(html).not.toContain('condition=caries');
    // no urgency badge for an unsure scan, only the neutral chip
    expect(html).toContain('data-testid="unsure-badge"');
    expect(html).not.toContain('data-urgency');
    // the three actions share one even grid: stacked full-width on mobile, three columns from md
    expect(html).toContain('data-testid="low-confidence-actions"');
    expect(html).toContain('md:grid-cols-3');
  });

  it('shows "Dibuat oleh AI" and feedback controls on Deni messages', () => {
    const html = renderToStaticMarkup(
      <DeniChat
        initialMessages={[
          {
            role: 'assistant',
            content: 'Sikat gigi secara teratur dan periksakan ke dokter gigi setiap 6 bulan.',
            timestamp: '2026-11-20T12:01:00.000Z',
            is_fallback: false,
          },
        ]}
      />,
    );
    expect(html).toContain('Dibuat oleh AI');
    expect(html).toContain('Membantu');
    expect(html).toContain('Tidak akurat');
    expect(html).not.toContain(FALLBACK_DENI_BANNER_TEXT);
    // No token in tests -> guest: login notice shown because the API requires auth for /chat
    expect(html).toContain('data-testid="deni-login-required"');
    expect(html).toContain('/login?redirect=/chat');
  });

  it('labels static LLM fallback replies plainly with the required Indonesian notice', () => {
    const html = renderToStaticMarkup(
      <DeniChat
        initialMessages={[
          {
            role: 'assistant',
            content: 'Panduan umum perawatan gigi preventif.',
            timestamp: '2026-11-20T12:02:00.000Z',
            is_fallback: true,
          },
        ]}
      />,
    );
    expect(html).toContain(FALLBACK_DENI_BANNER_TEXT);
    expect(html).toContain('Deni sedang tidak tersedia. Berikut panduan umum.');
  });

  it('renders AiFeedbackControl buttons cleanly and submits POST /feedback payload', async () => {
    const html = renderToStaticMarkup(
      <AiFeedbackControl targetType="scan" targetId="scan_t207_001" />,
    );
    expect(html).toContain('Membantu');
    expect(html).toContain('Tidak akurat');

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        status: 'success',
        message: 'Masukan Anda berhasil disimpan.',
        data: {
          id: 'fb_001',
          target_type: 'scan',
          target_id: 'scan_t207_001',
          rating: 'inaccurate',
          comment: 'Foto agak gelap',
          created_at: '2026-11-20T12:05:00.000Z',
        },
      },
    });

    const result = await submitAiFeedback({
      target_type: 'scan',
      target_id: 'scan_t207_001',
      rating: 'inaccurate',
      comment: 'Foto agak gelap',
    });

    expect(postSpy).toHaveBeenCalledWith('/feedback', {
      target_type: 'scan',
      target_id: 'scan_t207_001',
      rating: 'inaccurate',
      comment: 'Foto agak gelap',
    });
    expect(result.id).toBe('fb_001');
    expect(result.rating).toBe('inaccurate');
  });

  it('positions FloatingNavbar at bottom-center with clickable logo, responsive footer clearing mobile dock, and DeniMascot tooltip above Deni', () => {
    const navHtml = renderToStaticMarkup(<FloatingNavbar />);
    const footerHtml = renderToStaticMarkup(<AppFooter />);
    const mascotHtml = renderToStaticMarkup(<DeniMascot />);

    expect(navHtml).toContain('bottom-3');
    expect(navHtml).toContain('sm:bottom-6');
    expect(navHtml).toContain('data-testid="navbar-logo-home-link"');
    expect(navHtml).not.toContain('>Beranda<');
    // dock clearance applies at every width (it used to drop to pb-4 from md, hiding the footer)
    expect(footerHtml).toContain('pb-[var(--dock-clearance)]');
    expect(footerHtml).not.toContain('md:pb-4');
    // every dock target is at least 44 px
    expect(navHtml).toContain('min-h-touch min-w-touch');
    expect(navHtml).not.toContain('h-8');
    expect(footerHtml).toContain('text-xs');
    expect(footerHtml).not.toContain('Disclaimer Medis');
    expect(mascotHtml).toContain('bottom-24');
    // hidden on phones (the dock has a Deni tab) and starts visible from md until it collides
    expect(mascotHtml).toContain('hidden');
    expect(mascotHtml).toContain('md:flex');
    expect(mascotHtml).toContain('data-collides="false"');
    expect(mascotHtml).toContain('bottom-full');
    expect(mascotHtml).toContain('mb-2');
    expect(mascotHtml).toContain('animate-deni-float');
    expect(mascotHtml).toContain('animate-deni-tooltip-bounce');
  });
});
