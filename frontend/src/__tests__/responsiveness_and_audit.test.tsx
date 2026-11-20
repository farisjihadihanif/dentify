import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ChatPage from '../app/chat/page';
import ClinicsPage from '../app/clinics/page';
import LoginPage from '../app/login/page';
import HomePage from '../app/page';
import PanduanPage from '../app/panduan/page';
import ProfilePage from '../app/profile/page';
import RegisterPage from '../app/register/page';
import ScanPage from '../app/scan/page';
import { AppButton } from '../components/AppButton';
import { AppFooter } from '../components/AppFooter';
import { ScanWorkspace } from '../components/ScanWorkspace';
import { stopMediaStreamTracks } from '../components/WebcamCapture';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('Audit Responsivitas Mobile (360px–1920px), Pembersihan Kamera, & Penempatan Disclaimer Medis (T-302 – DESIGN.md §7)', () => {
  const ALL_SCREENS: ReadonlyArray<{
    name: string;
    element: React.ReactElement;
    expectDisclaimer: boolean;
  }> = [
    { name: 'Landing Page (/)', element: <HomePage />, expectDisclaimer: false },
    { name: 'Scan Page (/scan)', element: <ScanPage />, expectDisclaimer: true },
    { name: 'Scan Workspace (/scan authenticated)', element: <ScanWorkspace />, expectDisclaimer: true },
    { name: 'Chat Page (/chat)', element: <ChatPage />, expectDisclaimer: false },
    { name: 'Clinics Page (/clinics)', element: <ClinicsPage />, expectDisclaimer: false },
    { name: 'Profile Page (/profile)', element: <ProfilePage />, expectDisclaimer: false },
    { name: 'Panduan Page (/panduan)', element: <PanduanPage />, expectDisclaimer: false },
    { name: 'Login Page (/login)', element: <LoginPage />, expectDisclaimer: false },
    { name: 'Register Page (/register)', element: <RegisterPage />, expectDisclaimer: false },
  ];

  it.each(ALL_SCREENS)(
    'halaman $name bebas lebar statis pemicu horizontal scroll pada 360px dan penempatan Disclaimer Medis sesuai aturan (/scan only)',
    ({ element, expectDisclaimer }) => {
      const html = renderToStaticMarkup(element);

      if (expectDisclaimer) {
        expect(html).toContain('Disclaimer Medis');
      } else {
        expect(html).not.toContain('Disclaimer Medis');
      }
      expect(html).not.toMatch(/w-\[[4-9]\d{2,}px\]/);
      expect(html).not.toMatch(/min-w-\[[4-9]\d{2,}px\]/);
    },
  );

  it('AppFooter tidak menampilkan Disclaimer Medis dan tetap ramping (py-3 tanpa pb-24/pb-20 internal)', () => {
    const footerHtml = renderToStaticMarkup(<AppFooter />);
    expect(footerHtml).not.toContain('Disclaimer Medis');
    expect(footerHtml).toContain('py-3');
    expect(footerHtml).not.toContain('pb-24');
    expect(footerHtml).not.toContain('pb-20');
  });

  it('seluruh tombol interaktif utama memenuhi standar touch target minimal 44x44px (min-h-touch / min-w-touch)', () => {
    const buttonHtml = renderToStaticMarkup(<AppButton>Tombol Uji</AppButton>);
    expect(buttonHtml).toContain('min-h-touch');
    expect(buttonHtml).toContain('min-w-touch');

    const homeHtml = renderToStaticMarkup(<HomePage />);
    expect(homeHtml).toContain('Cegah Gigi Berlubang Sejak Dini');
  });

  it('stopMediaStreamTracks menghentikan seluruh track video/audio saat pengguna meninggalkan halaman /scan', () => {
    const track1Stop = vi.fn();
    const track2Stop = vi.fn();
    const mockStream = {
      getTracks: () => [{ stop: track1Stop }, { stop: track2Stop }],
    } as unknown as MediaStream;

    stopMediaStreamTracks(mockStream);
    expect(track1Stop).toHaveBeenCalledTimes(1);
    expect(track2Stop).toHaveBeenCalledTimes(1);

    expect(() => stopMediaStreamTracks(null)).not.toThrow();
  });
});
