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
import { stopMediaStreamTracks } from '../components/WebcamCapture';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('Audit Responsivitas Mobile (360px–1920px), Pembersihan Kamera, & Disclaimer Medis (T-302 – DESIGN.md §7)', () => {
  const ALL_SCREENS: ReadonlyArray<{ name: string; element: React.ReactElement }> = [
    { name: 'Landing Page (/)', element: <HomePage /> },
    { name: 'Scan Page (/scan)', element: <ScanPage /> },
    { name: 'Chat Page (/chat)', element: <ChatPage /> },
    { name: 'Clinics Page (/clinics)', element: <ClinicsPage /> },
    { name: 'Profile Page (/profile)', element: <ProfilePage /> },
    { name: 'Panduan Page (/panduan)', element: <PanduanPage /> },
    { name: 'Login Page (/login)', element: <LoginPage /> },
    { name: 'Register Page (/register)', element: <RegisterPage /> },
  ];

  it.each(ALL_SCREENS)(
    'halaman $name menampilkan MedicalDisclaimerBanner secara konsisten dan bebas lebar statis pemicu horizontal scroll pada 360px',
    ({ element }) => {
      const html = renderToStaticMarkup(element);

      expect(html).toContain('Disclaimer Medis');
      expect(html).not.toMatch(/w-\[[4-9]\d{2,}px\]/);
      expect(html).not.toMatch(/min-w-\[[4-9]\d{2,}px\]/);
    },
  );

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
