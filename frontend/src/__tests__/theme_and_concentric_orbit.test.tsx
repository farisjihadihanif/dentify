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

describe('T-210: Concentric Dental Instrument Orbit Hero & Light/Dark Theme System', () => {
  it('ConcentricDentalOrbit renders 4 circular orbit rings and all 8 frameless dental instrument silhouettes without boxes or drop-shadows', () => {
    const html = renderToStaticMarkup(<ConcentricDentalOrbit />);

    expect(CONCENTRIC_ORBIT_RINGS).toHaveLength(4);
    expect(html).toContain('data-testid="concentric-dental-orbit"');
    expect(html).toContain('data-testid="dentist-3d-canvas"');

    // All 4 rings and alternating orbital + counter-rotation classes
    expect(html).toContain('data-testid="orbit-ring-1"');
    expect(html).toContain('data-testid="orbit-ring-2"');
    expect(html).toContain('data-testid="orbit-ring-3"');
    expect(html).toContain('data-testid="orbit-ring-4"');
    expect(html).toContain('animate-orbit-cw-55');
    expect(html).toContain('animate-orbit-ccw-55');
    expect(html).toContain('animate-orbit-ccw-70');
    expect(html).toContain('animate-orbit-cw-70');
    expect(html).toContain('animate-orbit-cw-85');
    expect(html).toContain('animate-orbit-ccw-85');
    expect(html).toContain('animate-orbit-ccw-100');
    expect(html).toContain('animate-orbit-cw-100');

    // All 8 real clinical dental instruments
    const expectedInstruments = [
      'Kaca Mulut',
      'Sonde Gigi',
      'Pinset Gigi',
      'Scaler Periodontal',
      'Handpiece Bor Gigi',
      'Tang Pencabut Gigi',
      'Suntik Anestesi Lokal',
      'Gigi Molar Sehat',
    ];
    for (const label of expectedInstruments) {
      expect(html).toContain(`data-instrument="${label}"`);
    }

    // Frameless check: ZERO rounded-square icon boxes, card backgrounds, or glow drop-shadows
    expect(html).not.toContain('rounded-2xl');
    expect(html).not.toContain('rounded-xl');
    expect(html).not.toContain('shadow-');
    expect(html).not.toContain('drop-shadow');
    expect(html).not.toContain('bg-surface');
    expect(html).not.toContain('backdrop-blur');
  });

  it('ThemeProvider and ThemeToggleButton render Light and Dark states for floating and inline variants', () => {
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

    expect(THEME_STORAGE_KEY).toBe('denthub_theme');
    expect(resolveInitialTheme()).toBe('light');
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

  it('HomePage, PanduanPage, and KineticMarqueeRibbons preserve high-contrast white text on dark navy and teal containers for Dark Mode', () => {
    const homeHtml = renderToStaticMarkup(<HomePage />);
    expect(homeHtml).toContain('data-testid="concentric-dental-orbit"');
    expect(homeHtml).toContain('bg-surface-teal text-white');
    expect(homeHtml).not.toContain('bg-surface-teal text-surface');

    const panduanHtml = renderToStaticMarkup(<PanduanPage />);
    expect(panduanHtml).toContain('bg-surface-teal text-white');
    expect(panduanHtml).toContain('text-slate-200');
    expect(panduanHtml).not.toContain('bg-surface-teal text-surface');

    const marqueeHtml = renderToStaticMarkup(<KineticMarqueeRibbons />);
    expect(marqueeHtml).toContain('bg-surface-teal py-3.5 text-white');
    expect(marqueeHtml).toContain('bg-surface-navy py-3.5 text-white');
    expect(marqueeHtml).not.toContain('text-surface');
  });
});
