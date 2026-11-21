import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../app/page';
import PanduanPage from '../app/panduan/page';
import LoginPage from '../app/login/page';
import RegisterPage from '../app/register/page';
import { AppFooter } from '../components/AppFooter';
import { AdminDashboardView } from '../components/AdminDashboardView';
import { BeritaArticleDetailView } from '../components/BeritaArticleDetailView';
import { BeritaPortalView } from '../components/BeritaPortalView';
import {
  CONCENTRIC_ORBIT_RINGS,
  ConcentricDentalOrbit,
} from '../components/ConcentricDentalOrbit';
import { DeniMascot } from '../components/DeniMascot';
import { FloatingNavbar } from '../components/FloatingNavbar';
import { KineticMarqueeRibbons } from '../components/KineticMarqueeRibbons';
import { NewsPromoAdPopup } from '../components/NewsPromoAdPopup';
import { ProfileEditorView } from '../components/ProfileEditorView';
import {
  LOW_CONFIDENCE_WARNING_TEXT,
  ScanResultCard,
} from '../components/ScanResultCard';
import { StatusBadge } from '../components/StatusBadge';
import { computeAvatarFrameLayout } from '../utils/imageHelper';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

describe('Clinical Light Mode, 12-Instrument Orbit Hero, Profile Adjuster, Admin Cover Studio & Editorial Detail', () => {
  it('ConcentricDentalOrbit renders 4 bold circular orbit rings, starfield dots, and 12 frameless interactive dental instruments including AI Dental Scan', () => {
    const html = renderToStaticMarkup(<ConcentricDentalOrbit />);

    expect(CONCENTRIC_ORBIT_RINGS).toHaveLength(4);
    expect(html).toContain('data-testid="concentric-dental-orbit"');
    expect(html).toContain('data-testid="dentist-3d-canvas"');
    expect(html).toContain('data-testid="hero-starfield-dots"');
    expect(html).toContain('border-[1.75px]');

    // 4 alternating orbital & counter-rotation rings
    expect(html).toContain('animate-orbit-cw-60');
    expect(html).toContain('animate-orbit-ccw-60');
    expect(html).toContain('animate-orbit-ccw-75');
    expect(html).toContain('animate-orbit-cw-75');
    expect(html).toContain('animate-orbit-cw-90');
    expect(html).toContain('animate-orbit-ccw-90');
    expect(html).toContain('animate-orbit-ccw-105');
    expect(html).toContain('animate-orbit-cw-105');

    // All 12 frameless interactive dental instruments including AI Dental Scan
    const expectedInstruments = [
      'AI Dental Scan',
      'Kaca Mulut',
      'Gigi Molar Sehat',
      'Sonde Diagnostik',
      'Scaler Periodontal',
      'Sikat Gigi Klinis',
      'Handpiece Turbin',
      'Pinset Klinis',
      'Pasta Fluoride',
      'Tang Ekstraksi',
      'Spuit Anestesi',
      'Mahkota / Implan Gigi',
    ];
    for (const label of expectedInstruments) {
      expect(html).toContain(`data-instrument="${label}"`);
    }

    expect(html).toContain('pointer-events-auto');
    expect(html).not.toContain('rounded-2xl');
    expect(html).not.toContain('rounded-xl');
    expect(html).not.toContain('shadow-');
    expect(html).not.toContain('drop-shadow');
    expect(html).not.toContain('backdrop-blur');
  });

  it('Enforces pure Clinical Light Mode across Profile, Auth forms, StatusBadge, and DeniMascot without Dark Mode toggles', () => {
    const profileHtml = renderToStaticMarkup(
      <ProfileEditorView
        initialUser={{
          id: 'u-1',
          full_name: 'Faris Lubis',
          email: '',
          role: 'user',
        }}
      />,
    );
    expect(profileHtml).not.toContain('theme-toggle-inline');
    expect(profileHtml).not.toContain('Mode Gelap');
    expect(profileHtml).toContain('username@mail.com');
    expect(profileHtml).toContain('dikompres otomatis');

    const loginHtml = renderToStaticMarkup(<LoginPage />);
    const registerHtml = renderToStaticMarkup(<RegisterPage />);
    expect(loginHtml).toContain('placeholder="username@mail.com"');
    expect(registerHtml).toContain('placeholder="username@mail.com"');

    const lowHtml = renderToStaticMarkup(<StatusBadge urgency="low" />);
    expect(lowHtml).toContain('bg-status-green text-surface');
    expect(lowHtml).not.toContain('dark:');

    const mascotHtml = renderToStaticMarkup(<DeniMascot />);
    expect(mascotHtml).toContain('data-testid="deni-mascot-widget"');
    expect(mascotHtml).toContain('animate-deni-float');
  });

  it('ScanResultCard renders actionable low-confidence warning with direct links to Deni and /panduan#panduan-hasil-kurang-meyakinkan', () => {
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
    expect(html).toContain('data-testid="low-confidence-cta-deni"');
    expect(html).toContain('/chat?scan_id=scan-calc-1&amp;condition=calculus');
    expect(html).toContain('data-testid="low-confidence-cta-panduan"');
    expect(html).toContain('/panduan#panduan-hasil-kurang-meyakinkan');
  });

  it('AdminDashboardView renders Cover Frame Preview & Fit/Position Adjuster without character limits or dark mode wrappers', () => {
    const adminHtml = renderToStaticMarkup(
      <AdminDashboardView
        initialUser={{
          id: 'admin-1',
          full_name: 'Admin DentHub',
          email: 'admin@denthub.id',
          role: 'admin',
        }}
        initialArticles={[]}
        initialUsers={[]}
      />,
    );
    expect(adminHtml).toContain('data-testid="admin-cover-frame-adjuster"');
    expect(adminHtml).toContain('Pas Penuh (Utuh tanpa terpotong)');
    expect(adminHtml).toContain('Isi Frame (Cover)');
    expect(adminHtml).toContain('Tanpa Batas Karakter');
    expect(adminHtml).not.toContain('admin-monochrome-theme');
  });

  it('BeritaArticleDetailView renders publication-grade max-w-[1280px] 2-column editorial layout with breadcrumb, share button, Promo claim card, and sticky related sidebar', () => {
    const html = renderToStaticMarkup(
      <BeritaArticleDetailView
        slug="promo-scaling-mahasiswa"
        initialArticle={{
          id: 'art-promo-1',
          title: 'Promo Scaling Mahasiswa Diskon 50%',
          slug: 'promo-scaling-mahasiswa',
          category: 'Promo',
          summary: 'Program pemeriksaan dan scaling hemat bagi pelajar dan mahasiswa.',
          content:
            'Paragraf pembuka tentang pentingnya pembersihan karang gigi secara rutin.\n\nParagraf kedua menjelaskan detail klaim promo dan jadwal kunjungan klinik mitra.',
          coverImageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          coverFit: 'contain',
          coverPosition: '50% 50%',
          coverZoom: 1,
          isPublished: true,
          authorName: 'Tim Promo DentHub',
          publishedAt: '2026-11-20T08:00:00.000Z',
        }}
        initialRelatedArticles={[
          {
            id: 'art-rel-1',
            title: 'Cara Memilih Sikat Gigi yang Tepat',
            slug: 'cara-memilih-sikat-gigi',
            category: 'Artikel',
            summary: 'Panduan memilih bulu sikat lembut.',
            content: 'Gunakan sikat gigi berbulu lembut.',
            coverImageUrl: '/images/covers/artikel-default.svg',
            isPublished: true,
            authorName: 'Tim Redaksi DentHub',
            publishedAt: '2026-11-19T08:00:00.000Z',
          },
        ]}
      />,
    );

    expect(html).toContain('max-w-[1280px]');
    expect(html).toContain('data-testid="berita-detail-breadcrumb"');
    expect(html).toContain('data-testid="berita-share-copy-btn"');
    expect(html).toContain('Salin Tautan');
    expect(html).toContain('data-testid="berita-hero-media-stage"');
    expect(html).toContain('object-contain');
    expect(html).toContain('data-testid="berita-promo-claim-card"');
    expect(html).toContain('Info &amp; Klaim Promo Layanan Gigi');
    expect(html).toContain('data-testid="berita-detail-sidebar"');
    expect(html).toContain('Berita, Artikel &amp; Promo Lainnya');
    expect(html).toContain('Cara Memilih Sikat Gigi yang Tepat');
    expect(html).toContain('Skrining &amp; Konsultasi DentHub');
  });

  it('HomePage, PanduanPage, and KineticMarqueeRibbons preserve clean contrast and Step 07 guide', () => {
    const homeHtml = renderToStaticMarkup(<HomePage />);
    expect(homeHtml).toContain('data-testid="concentric-dental-orbit"');
    expect(homeHtml).toContain('bg-surface-teal text-white');

    const panduanHtml = renderToStaticMarkup(<PanduanPage />);
    expect(panduanHtml).toContain('id="panduan-hasil-kurang-meyakinkan"');
    expect(panduanHtml).toContain('Jika Hasil Scan Kurang Meyakinkan');

    const marqueeHtml = renderToStaticMarkup(<KineticMarqueeRibbons />);
    expect(marqueeHtml).toContain('bg-surface-teal py-3.5 text-white');
    expect(marqueeHtml).toContain('bg-surface-navy py-3.5 text-white');
  });

  it('AppFooter links Faris Jihadi Hanif Lubis to Instagram without visited color shift, FloatingNavbar stays compact on mobile, and computeAvatarFrameLayout matches 1:1 between 144px preview and 320px export', () => {
    const defaultFooter = renderToStaticMarkup(<AppFooter pathnameOverride="/" />);
    expect(defaultFooter).toContain('href="https://www.instagram.com/farisjihadihanif/"');
    expect(defaultFooter).toContain('target="_blank"');
    expect(defaultFooter).toContain('rel="noopener noreferrer"');
    expect(defaultFooter).toContain('visited:text-brand-dark');

    const panduanFooter = renderToStaticMarkup(<AppFooter pathnameOverride="/panduan" />);
    expect(panduanFooter).toContain('visited:text-white');

    const navHtml = renderToStaticMarkup(<FloatingNavbar pathnameOverride="/" />);
    expect(navHtml).toContain('bottom-3');
    expect(navHtml).toContain('px-1.5 py-1');
    expect(navHtml).toContain('h-8 shrink-0');
    expect(navHtml).toContain('text-[11px]');

    // Exact 1:1 normalized geometry parity between 144px circular preview and 320px canvas export
    const preview = computeAvatarFrameLayout(144, 1600, 900, 1.6, 25, -18);
    const exported = computeAvatarFrameLayout(320, 1600, 900, 1.6, 25, -18);
    expect(preview.drawW / 144).toBeCloseTo(exported.drawW / 320, 6);
    expect(preview.drawH / 144).toBeCloseTo(exported.drawH / 320, 6);
    expect(preview.left / 144).toBeCloseTo(exported.left / 320, 6);
    expect(preview.top / 144).toBeCloseTo(exported.top / 320, 6);
  });

  it('FloatingNavbar shows circular user avatar in both docks when present, and poster covers remain uncropped in modal, popup, and detail page', () => {
    const sampleAvatar = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const bottomWithAvatar = renderToStaticMarkup(
      <FloatingNavbar pathnameOverride="/" initialAvatar={sampleAvatar} />,
    );
    expect(bottomWithAvatar).toContain('data-testid="navbar-profile-avatar"');
    expect(bottomWithAvatar).toContain('alt="Foto Profil"');
    expect(bottomWithAvatar).toContain('rounded-full object-cover ring-1 ring-current');

    const chatWithAvatar = renderToStaticMarkup(
      <FloatingNavbar pathnameOverride="/chat" initialAvatar={sampleAvatar} />,
    );
    expect(chatWithAvatar).toContain('data-orientation="vertical-right"');
    expect(chatWithAvatar).toContain('data-testid="navbar-profile-avatar"');

    const bottomWithoutAvatar = renderToStaticMarkup(
      <FloatingNavbar pathnameOverride="/" initialAvatar="" />,
    );
    expect(bottomWithoutAvatar).not.toContain('data-testid="navbar-profile-avatar"');

    const posterArticle = {
      id: 'promo-poster-1',
      title: 'Promo Poster Scaling Gigi',
      slug: 'promo-poster-scaling',
      category: 'Promo' as const,
      summary: 'Poster vertikal lengkap dengan harga dan syarat ketentuan.',
      content: 'Detail promo lengkap.',
      coverImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      coverFit: 'contain' as const,
      coverPosition: '50% 50%',
      coverZoom: 1,
      isPublished: true,
      authorName: 'Tim Promo DentHub',
      publishedAt: '2026-11-21T08:00:00.000Z',
    };

    const modalHtml = renderToStaticMarkup(
      <BeritaPortalView
        initialArticles={[{ ...posterArticle, coverFit: 'cover' }]}
        initialPreviewArticle={{ ...posterArticle, coverFit: 'cover' }}
      />,
    );
    expect(modalHtml).toContain('data-testid="berita-preview-media-frame"');
    expect(modalHtml).toContain('max-h-[340px] w-auto max-w-full rounded-xl object-contain');
    expect(modalHtml).not.toContain('aspect-[16/10]');

    const popupHtml = renderToStaticMarkup(
      <NewsPromoAdPopup
        initialArticle={{ ...posterArticle, coverFit: 'cover' }}
        pathnameOverride="/"
      />,
    );
    expect(popupHtml).toContain('data-testid="ad-popup-media-frame"');
    expect(popupHtml).toContain('max-h-[340px] w-auto max-w-full rounded-xl object-contain');
    expect(popupHtml).not.toContain('aspect-[16/10]');
    expect(popupHtml).not.toContain('object-cover');

    // Vertical/square image saved with coverFit:'cover' stays uncropped in detail page
    const detailVerticalCoverHtml = renderToStaticMarkup(
      <BeritaArticleDetailView
        slug={posterArticle.slug}
        initialArticle={{ ...posterArticle, coverFit: 'cover' }}
        initialCoverNaturalSize={{ width: 800, height: 1200 }}
      />,
    );
    expect(detailVerticalCoverHtml).toContain(
      'mx-auto max-h-[540px] w-auto max-w-full rounded-xl object-contain',
    );
    expect(detailVerticalCoverHtml).toContain('pb-28');

    // Wide landscape image saved with coverFit:'cover' uses wide hero cover framing
    const detailLandscapeCoverHtml = renderToStaticMarkup(
      <BeritaArticleDetailView
        slug="artikel-cover-1"
        initialArticle={{
          ...posterArticle,
          id: 'art-cover-1',
          slug: 'artikel-cover-1',
          category: 'Artikel',
          coverFit: 'cover',
          coverPosition: '50% 30%',
          coverZoom: 1.2,
        }}
        initialCoverNaturalSize={{ width: 1600, height: 900 }}
      />,
    );
    expect(detailLandscapeCoverHtml).toContain('max-h-[460px] w-full object-cover');
    expect(detailLandscapeCoverHtml).toContain('object-position:50% 30%');
    expect(detailLandscapeCoverHtml).toContain('scale(1.2)');
  });
});
