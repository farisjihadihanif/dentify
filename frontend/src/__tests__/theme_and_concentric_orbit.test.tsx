import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';
import PanduanPage from '../app/panduan/page';
import {
  CONCENTRIC_ORBIT_RINGS,
  ConcentricDentalOrbit,
} from '../components/ConcentricDentalOrbit';
import { KineticMarqueeRibbons } from '../components/KineticMarqueeRibbons';
import { ProfileEditorView } from '../components/ProfileEditorView';
import {
  LOW_CONFIDENCE_WARNING_TEXT,
  ScanResultCard,
} from '../components/ScanResultCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  THEME_STORAGE_KEY,
  ThemeProvider,
  resolveInitialTheme,
} from '../components/ThemeProvider';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('T-210 & T-211: Interactive Concentric Dental Instrument Orbit, Monochrome Dark Mode & 4-Class Calculus', () => {
  it('ConcentricDentalOrbit renders 4 circular orbit rings and 8 bold 48px-64px interactive frameless dental instruments with tooltips and zero boxes/drop-shadows', () => {
    const html = renderToStaticMarkup(<ConcentricDentalOrbit />);

    expect(CONCENTRIC_ORBIT_RINGS).toHaveLength(4);
    expect(html).toContain('data-testid="concentric-dental-orbit"');
    expect(html).toContain('data-testid="dentist-3d-canvas"');

    // All 4 rings and alternating calm orbital + counter-rotation classes (60s-105s)
    expect(html).toContain('data-testid="orbit-ring-1"');
    expect(html).toContain('data-testid="orbit-ring-2"');
    expect(html).toContain('data-testid="orbit-ring-3"');
    expect(html).toContain('data-testid="orbit-ring-4"');
    expect(html).toContain('animate-orbit-cw-60');
    expect(html).toContain('animate-orbit-ccw-60');
    expect(html).toContain('animate-orbit-ccw-75');
    expect(html).toContain('animate-orbit-cw-75');
    expect(html).toContain('animate-orbit-cw-90');
    expect(html).toContain('animate-orbit-ccw-90');
    expect(html).toContain('animate-orbit-ccw-105');
    expect(html).toContain('animate-orbit-cw-105');

    // 2.2x larger instrument silhouettes (48px-64px) & interactive buttons with pointer-events-auto
    expect(html).toContain('h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16');
    expect(html).toContain('pointer-events-auto');

    // All 8 clinical dental instruments & tooltips
    const expectedTooltips = [
      'Kaca Mulut • Pemeriksaan Visual',
      'Sonde Diagnostik • Deteksi Karies',
      'Scaler Periodontal • Pembersih Karang Gigi',
      'Handpiece Turbin • Perawatan Gigi',
      'Pinset Klinis • Presisi Perawatan',
      'Tang Ekstraksi • Bedah Oral',
      'Spuit Anestesi • Kontrol Nyeri',
      'Molar Sehat • Screening Preventif',
    ];
    for (const tooltip of expectedTooltips) {
      expect(html).toContain(tooltip);
    }

    // Frameless check: ZERO rounded-square icon boxes, card shadows, or glow drop-shadows
    expect(html).not.toContain('rounded-2xl');
    expect(html).not.toContain('rounded-xl');
    expect(html).not.toContain('shadow-');
    expect(html).not.toContain('drop-shadow');
    expect(html).not.toContain('backdrop-blur');
  });

  it('ThemeProvider, ThemeToggleButton, and StatusBadge implement Obsidian & Monochrome Clinical Dark Mode with desaturated matte badges', () => {
    const lightFloatingHtml = renderToStaticMarkup(
      <ThemeProvider initialTheme="light">
        <ThemeToggleButton variant="floating" />
      </ThemeProvider>,
    );
    expect(lightFloatingHtml).toContain('data-testid="theme-toggle-btn"');
    expect(lightFloatingHtml).toContain('aria-label="Aktifkan Mode Gelap"');
    expect(lightFloatingHtml).toContain('aria-pressed="false"');

    const darkFloatingHtml = renderToStaticMarkup(
      <ThemeProvider initialTheme="dark">
        <ThemeToggleButton variant="floating" />
      </ThemeProvider>,
    );
    expect(darkFloatingHtml).toContain('aria-label="Aktifkan Mode Terang"');
    expect(darkFloatingHtml).toContain('aria-pressed="true"');

    const inlineDarkHtml = renderToStaticMarkup(
      <ThemeProvider initialTheme="dark">
        <ThemeToggleButton variant="inline" />
      </ThemeProvider>,
    );
    expect(inlineDarkHtml).toContain('data-testid="theme-toggle-inline"');
    expect(inlineDarkHtml).toContain('Mode Terang');
    expect(inlineDarkHtml).toContain('Gelap');

    // Desaturated matte dark-mode status badges
    const lowHtml = renderToStaticMarkup(<StatusBadge urgency="low" />);
    const medHtml = renderToStaticMarkup(<StatusBadge urgency="medium" />);
    const emgHtml = renderToStaticMarkup(<StatusBadge urgency="emergency" />);
    expect(lowHtml).toContain('dark:bg-emerald-950/50 dark:text-emerald-300');
    expect(medHtml).toContain('dark:bg-amber-950/50 dark:text-amber-300');
    expect(emgHtml).toContain('dark:bg-rose-950/50 dark:text-rose-300');

    expect(THEME_STORAGE_KEY).toBe('denthub_theme');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('ScanResultCard displays 4th category calculus (Karang Gigi & Plak) and amber low-confidence guidance when is_low_confidence is true', () => {
    const html = renderToStaticMarkup(
      <ScanResultCard
        report={{
          id: 'scan-calc-1',
          capture_source: 'upload',
          primary_condition: 'calculus',
          condition_label: 'Indikasi Karang Gigi & Plak (Kalkulus Dental)',
          confidence_score: 0.54,
          is_low_confidence: true,
          detections: [{ label: 'calculus', confidence: 0.54, bbox: [12, 18, 90, 60] }],
          urgency_level: 'medium',
          trigger_clinic_finder: false,
          care_recommendations: {
            summary: 'Terdeteksi indikasi karang gigi & plak (kalkulus dental).',
            dos: ['Jadwalkan tindakan pembersihan karang gigi profesional (scaling).'],
            donts: ['Jangan mencoba mengikis karang gigi sendiri dengan alat tajam.'],
          },
          medical_disclaimer: 'Hasil ini bukan diagnosis medis.',
          created_at: '2026-11-21T08:00:00.000Z',
        }}
      />,
    );

    expect(html).toContain('Indikasi Karang Gigi &amp; Plak (Kalkulus Dental)');
    expect(html).toContain('data-testid="low-confidence-warning"');
    expect(html).toContain(LOW_CONFIDENCE_WARNING_TEXT);
  });

  it('ProfileEditorView exposes the inline Light/Dark theme toggle in the settings sidebar', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider initialTheme="light">
        <ProfileEditorView
          initialUser={{
            id: 'u-1',
            full_name: 'Faris Lubis',
            email: 'faris@denthub.id',
            role: 'user',
          }}
        />
      </ThemeProvider>,
    );

    expect(html).toContain('Tampilan Aplikasi');
    expect(html).toContain('data-testid="theme-toggle-inline"');
    expect(html).toContain('Mode Gelap');
  });

  it('HomePage, PanduanPage, and KineticMarqueeRibbons preserve high-contrast white text on dark containers without cyan accents', () => {
    const homeHtml = renderToStaticMarkup(<HomePage />);
    expect(homeHtml).toContain('data-testid="concentric-dental-orbit"');
    expect(homeHtml).toContain('bg-surface-teal text-white');
    expect(homeHtml).not.toContain('bg-surface-teal text-surface');

    const panduanHtml = renderToStaticMarkup(<PanduanPage />);
    expect(panduanHtml).toContain('bg-surface-teal text-white');
    expect(panduanHtml).toContain('text-slate-200');
    expect(panduanHtml).not.toContain('bg-surface-teal text-surface');
    expect(panduanHtml).not.toContain('text-cyan-200');

    const marqueeHtml = renderToStaticMarkup(<KineticMarqueeRibbons />);
    expect(marqueeHtml).toContain('bg-surface-teal py-3.5 text-white');
    expect(marqueeHtml).toContain('bg-surface-navy py-3.5 text-white');
    expect(marqueeHtml).not.toContain('text-surface');
    expect(marqueeHtml).not.toContain('text-cyan-200');
  });
});
