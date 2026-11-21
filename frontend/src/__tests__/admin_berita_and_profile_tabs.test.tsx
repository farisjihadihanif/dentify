import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFooter } from '../components/AppFooter';
import { AdminRolePill } from '../components/AdminRolePill';
import { AdminDashboardView } from '../components/AdminDashboardView';
import { BeritaPortalView } from '../components/BeritaPortalView';
import { BeritaArticleDetailView } from '../components/BeritaArticleDetailView';
import { FloatingNavbar } from '../components/FloatingNavbar';
import { NewsPromoAdPopup, isAdPopupExcludedPath } from '../components/NewsPromoAdPopup';
import { ProfileEditorView } from '../components/ProfileEditorView';
import HomePage from '../app/page';
import PanduanPage from '../app/panduan/page';
import apiClient from '../services/apiClient';
import {
  fetchArticleBySlug,
  fetchPublishedArticles,
  getOrderedCategories,
  type ArticleItem,
} from '../services/articleService';
import {
  adminCreateArticle,
  adminDeleteArticle,
  adminDeleteUser,
  adminFetchArticles,
  adminFetchUsers,
  adminUpdateUserRole,
} from '../services/adminService';
import type { AuthUser } from '../services/authService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const SAMPLE_ARTICLES: ArticleItem[] = [
  {
    id: 'art-1',
    title: 'Promo Scaling Gigi 25% RSGM',
    slug: 'promo-scaling-gigi-25',
    category: 'Promo',
    summary: 'Potongan biaya scaling ultrasonik di mitra RSGM bagi pengguna DentHub.',
    content: 'Paragraf satu promo.\n\nParagraf dua syarat dan ketentuan.',
    coverImageUrl: '/images/covers/promo-scaling.svg',
    isPublished: true,
    authorName: 'Tim Kemitraan DentHub',
    publishedAt: '2026-11-20T08:00:00.000Z',
  },
  {
    id: 'art-2',
    title: 'DentHub Luncurkan Model AI CLAHE',
    slug: 'denthub-model-ai-clahe',
    category: 'Berita',
    summary: 'Peningkatan akurasi skrining gigi menggunakan OpenCV LAB CLAHE.',
    content: 'Paragraf berita satu.\n\nParagraf berita dua.',
    coverImageUrl: '/images/covers/berita-ai.svg',
    isPublished: true,
    authorName: 'Redaksi Teknologi DentHub',
    publishedAt: '2026-11-19T07:30:00.000Z',
  },
  {
    id: 'art-3',
    title: 'Panduan Scaling Rutin 6 Bulan',
    slug: 'panduan-scaling-rutin-6-bulan',
    category: 'Artikel',
    summary: 'Alasan medis mengapa karang gigi perlu dibersihkan setiap 6 bulan.',
    content: 'Paragraf artikel satu.\n\nParagraf artikel dua.',
    coverImageUrl: '/images/covers/artikel-scaling.svg',
    isPublished: true,
    authorName: 'Tim Edukasi DentHub',
    publishedAt: '2026-11-17T06:00:00.000Z',
  },
];

const SAMPLE_ADMIN: AuthUser = {
  id: 'admin-1',
  full_name: 'Admin DentHub',
  username: 'admindenthub',
  email: 'admin@denthub.local',
  avatar: '',
  role: 'admin',
};

const SAMPLE_USER: AuthUser = {
  id: 'user-2',
  full_name: 'Nadia Putri',
  username: 'nadiaputri',
  email: 'nadia@denthub.id',
  avatar: '',
  role: 'user',
};

describe('T-208 Footer Vertical Link Stack & Admin Role Pill', () => {
  it('stacks credits on left and Panduan Aplikasi + Promo, Berita & Artikel on right with mobile dock clearance', () => {
    const html = renderToStaticMarkup(<AppFooter />);
    expect(html).toContain('data-testid="footer-left-credits"');
    expect(html).toContain('created by');
    expect(html).toContain('Denthub © 2026');
    expect(html).toContain('data-testid="footer-right-links"');
    expect(html).toContain('pb-24');
    expect(html).toContain('md:pb-4');
    expect(html).toContain('href="/panduan"');
    expect(html).toContain('href="/berita"');
    expect(html).toContain('Panduan Aplikasi');
    expect(html).toContain('Promo, Berita &amp; Artikel');
    expect(html.indexOf('/panduan')).toBeLessThan(html.indexOf('/berita'));

    // Hidden on /chat
    const chatFooterHtml = renderToStaticMarkup(<AppFooter pathnameOverride="/chat" />);
    expect(chatFooterHtml).toBe('');

    // Dark-navy high-contrast footer on /panduan
    const panduanFooterHtml = renderToStaticMarkup(<AppFooter pathnameOverride="/panduan" />);
    expect(panduanFooterHtml).toContain('data-theme="navy"');
    expect(panduanFooterHtml).toContain('bg-surface-navy');
    expect(panduanFooterHtml).toContain('text-slate-200');
    expect(panduanFooterHtml).toContain('text-white');
    expect(panduanFooterHtml).toContain('border-white/20 bg-white/10 text-white');
    expect(panduanFooterHtml).toContain('hover:text-white');

    // Vertical right-edge nav on /chat only, horizontal bottom dock elsewhere
    const chatNavHtml = renderToStaticMarkup(<FloatingNavbar pathnameOverride="/chat" />);
    expect(chatNavHtml).toContain('data-orientation="vertical-right"');
    expect(chatNavHtml).toContain('right-4');
    expect(chatNavHtml).toContain('flex-col');

    const homeNavHtml = renderToStaticMarkup(<FloatingNavbar pathnameOverride="/" />);
    expect(homeNavHtml).toContain('data-orientation="horizontal-bottom"');
    expect(homeNavHtml).toContain('bottom-5');
  });

  it('renders AdminRolePill only for admin users and hides it on /admin', () => {
    const adminHtml = renderToStaticMarkup(
      <AdminRolePill initialUser={SAMPLE_ADMIN} pathnameOverride="/" />,
    );
    expect(adminHtml).toContain('data-testid="admin-role-pill"');
    expect(adminHtml).toContain('href="/admin"');

    const userHtml = renderToStaticMarkup(
      <AdminRolePill initialUser={SAMPLE_USER} pathnameOverride="/" />,
    );
    expect(userHtml).toBe('');

    const onAdminHtml = renderToStaticMarkup(
      <AdminRolePill initialUser={SAMPLE_ADMIN} pathnameOverride="/admin" />,
    );
    expect(onAdminHtml).toBe('');
  });
});

describe('T-208 Automatic Ad-Style Pop-Up (NewsPromoAdPopup)', () => {
  it('displays ad-style modal on standard routes and excludes /admin and /berita/[slug]', () => {
    expect(isAdPopupExcludedPath('/')).toBe(false);
    expect(isAdPopupExcludedPath('/berita')).toBe(false);
    expect(isAdPopupExcludedPath('/admin')).toBe(true);
    expect(isAdPopupExcludedPath('/berita/promo-scaling-gigi-25')).toBe(true);

    const homePopupHtml = renderToStaticMarkup(
      <NewsPromoAdPopup initialArticle={SAMPLE_ARTICLES[0]} pathnameOverride="/" />,
    );
    expect(homePopupHtml).toContain('data-testid="news-promo-ad-popup"');
    expect(homePopupHtml).toContain('role="dialog"');
    expect(homePopupHtml).toContain('Promo Scaling Gigi 25% RSGM');
    expect(homePopupHtml).toContain('href="/berita/promo-scaling-gigi-25"');

    const excludedHtml = renderToStaticMarkup(
      <NewsPromoAdPopup
        initialArticle={SAMPLE_ARTICLES[0]}
        pathnameOverride="/berita/promo-scaling-gigi-25"
      />,
    );
    expect(excludedHtml).toBe('');
  });
});

describe('T-208 /berita Digital Library Portal & Two-Step Reader (/berita/[slug])', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reorders categories dynamically so the selected category moves to the top', () => {
    expect(getOrderedCategories('Berita')).toEqual(['Berita', 'Promo', 'Artikel']);
    expect(getOrderedCategories('Promo')).toEqual(['Promo', 'Berita', 'Artikel']);
    expect(getOrderedCategories('Artikel')).toEqual(['Artikel', 'Berita', 'Promo']);
  });

  it('renders centered search bar, custom styled category dropdown, 3 horizontal shelves, and Step 1 preview modal without eyebrow badge', () => {
    const html = renderToStaticMarkup(
      <BeritaPortalView
        initialArticles={SAMPLE_ARTICLES}
        initialCategory="Promo"
        initialDropdownOpen
        initialPreviewArticle={SAMPLE_ARTICLES[0]}
      />,
    );

    expect(html).toContain('data-testid="berita-section-1-search"');
    expect(html).not.toContain('Portal Informasi &amp; Pustaka Digital DentHub');
    expect(html).toContain('data-testid="berita-category-select"');
    expect(html).toContain('data-testid="berita-category-menu"');
    expect(html).toContain('data-testid="berita-category-option-promo"');
    expect(html).toContain('overflow-x-auto');
    expect(html.indexOf('data-testid="berita-shelf-promo"')).toBeLessThan(
      html.indexOf('data-testid="berita-shelf-berita"'),
    );
    expect(html).toContain('data-testid="berita-preview-modal"');
    expect(html).toContain('opacity-100');
    expect(html).toContain('Baca Selengkapnya');
    expect(html).toContain('href="/berita/promo-scaling-gigi-25"');
  });

  it('renders Step 2 full newspaper/article reader at /berita/[slug] with multi-paragraph body', () => {
    const html = renderToStaticMarkup(
      <BeritaArticleDetailView
        slug="promo-scaling-gigi-25"
        initialArticle={SAMPLE_ARTICLES[0]}
      />,
    );
    expect(html).toContain('data-testid="berita-detail-page"');
    expect(html).toContain('Promo Scaling Gigi 25% RSGM');
    expect(html).toContain('Tim Kemitraan DentHub');
    expect(html).toContain('Paragraf satu promo.');
    expect(html).toContain('Paragraf dua syarat dan ketentuan.');
    expect(html).toContain('href="/berita"');
  });

  it('hits public /articles and /articles/:slug endpoints', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { success: true, data: SAMPLE_ARTICLES } })
      .mockResolvedValueOnce({ data: { success: true, data: SAMPLE_ARTICLES[0] } });

    const list = await fetchPublishedArticles({ category: 'Promo' });
    expect(list).toHaveLength(3);
    expect(getSpy).toHaveBeenNthCalledWith(1, '/articles', { params: { category: 'Promo' } });

    const detail = await fetchArticleBySlug('promo-scaling-gigi-25');
    expect(detail.slug).toBe('promo-scaling-gigi-25');
    expect(getSpy).toHaveBeenNthCalledWith(2, '/articles/promo-scaling-gigi-25');
  });
});

describe('T-208 /admin CMS & User Management Dashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both Admin tabs for admin users and hides workspace for regular users', () => {
    const articlesTabHtml = renderToStaticMarkup(
      <AdminDashboardView
        initialUser={SAMPLE_ADMIN}
        initialTab="articles"
        initialArticles={SAMPLE_ARTICLES}
        initialUsers={[SAMPLE_ADMIN, SAMPLE_USER]}
      />,
    );
    expect(articlesTabHtml).toContain('data-testid="admin-dashboard-workspace"');
    expect(articlesTabHtml).toContain('Kelola Berita, Promo &amp; Artikel');
    expect(articlesTabHtml).toContain('Kelola Akun Pengguna');
    expect(articlesTabHtml).toContain('data-testid="admin-panel-articles"');
    expect(articlesTabHtml).toContain('Promo Scaling Gigi 25% RSGM');

    const usersTabHtml = renderToStaticMarkup(
      <AdminDashboardView
        initialUser={SAMPLE_ADMIN}
        initialTab="users"
        initialArticles={SAMPLE_ARTICLES}
        initialUsers={[SAMPLE_ADMIN, SAMPLE_USER]}
      />,
    );
    expect(usersTabHtml).toContain('data-testid="admin-panel-users"');
    expect(usersTabHtml).toContain('Nadia Putri');
    expect(usersTabHtml).toContain('nadia@denthub.id');

    const nonAdminHtml = renderToStaticMarkup(
      <AdminDashboardView initialUser={SAMPLE_USER} />,
    );
    expect(nonAdminHtml).toBe('');
  });

  it('calls /admin/articles and /admin/users endpoints via adminService', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ data: { success: true, data: SAMPLE_ARTICLES } })
      .mockResolvedValueOnce({ data: { success: true, data: [SAMPLE_USER] } });
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: SAMPLE_ARTICLES[0] },
    });
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      data: { success: true, message: 'OK', data: { ...SAMPLE_USER, role: 'admin' } },
    });
    const deleteSpy = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValueOnce({ data: { success: true, message: 'Deleted article' } })
      .mockResolvedValueOnce({ data: { success: true, message: 'Deleted user' } });

    await adminFetchArticles();
    await adminFetchUsers('nadia');
    await adminCreateArticle({
      title: 'Artikel Uji',
      category: 'Berita',
      summary: 'Ringkasan uji minimal sepuluh karakter.',
      content: 'Konten uji panjang minimal dua puluh karakter untuk admin.',
    });
    await adminUpdateUserRole('user-2', 'admin');
    await adminDeleteArticle('art-1');
    await adminDeleteUser('user-2');

    expect(getSpy).toHaveBeenNthCalledWith(1, '/admin/articles');
    expect(getSpy).toHaveBeenNthCalledWith(2, '/admin/users', { params: { q: 'nadia' } });
    expect(postSpy).toHaveBeenCalledWith('/admin/articles', expect.objectContaining({ title: 'Artikel Uji' }));
    expect(patchSpy).toHaveBeenCalledWith('/admin/users/user-2', { role: 'admin' });
    expect(deleteSpy).toHaveBeenNthCalledWith(1, '/admin/articles/art-1');
    expect(deleteSpy).toHaveBeenNthCalledWith(2, '/admin/users/user-2');
  });
});

describe('T-208 Edge-to-Edge Home Section 2 & /panduan + Tabbed /profile', () => {
  it('renders Home Section 2 without eyebrow/subtitle and /panduan with interactive DENTHUB. display wordmark', () => {
    const homeHtml = renderToStaticMarkup(<HomePage />);
    expect(homeHtml).toContain('data-testid="home-section-2-flow"');
    expect(homeHtml).toContain('w-full bg-surface-navy');
    expect(homeHtml).toContain('max-w-[1380px]');
    expect(homeHtml).toContain('min-h-[250px]');
    expect(homeHtml).not.toContain('AI Dental Screening • Dunia Dentist 3D');
    expect(homeHtml).not.toContain('Alur Penggunaan Aplikasi');
    expect(homeHtml).not.toContain('Ikuti 4 langkah berurutan');

    const panduanHtml = renderToStaticMarkup(<PanduanPage />);
    expect(panduanHtml).toContain('data-testid="panduan-section-1-steps"');
    expect(panduanHtml).toContain('data-testid="panduan-section-2-dentist-world"');
    expect(panduanHtml).toContain('data-testid="panduan-bottom-wordmark"');
    expect(panduanHtml).toContain('data-testid="panduan-bottom-kinetic-ribbon"');
    expect(panduanHtml).toContain('aria-label="DENTHUB."');
    expect(panduanHtml).not.toContain('hover:text-surface-mint');
    expect(panduanHtml).toContain('max-w-[1380px]');
    expect(panduanHtml).toContain('min-h-[250px]');
  });

  it('renders only the single active tab in ProfileEditorView and shows Admin Panel link for admins', () => {
    const securityHtml = renderToStaticMarkup(
      <ProfileEditorView initialUser={SAMPLE_ADMIN} initialSection="security" />,
    );
    expect(securityHtml).toContain('data-testid="profile-panel-security"');
    expect(securityHtml).not.toContain('data-testid="profile-panel-general"');
    expect(securityHtml).not.toContain('data-testid="profile-session-card"');
    expect(securityHtml).toContain('data-testid="profile-admin-panel-link"');
    expect(securityHtml).toContain('Admin Panel');

    const regularUserHtml = renderToStaticMarkup(
      <ProfileEditorView initialUser={SAMPLE_USER} initialSection="general" />,
    );
    expect(regularUserHtml).toContain('data-testid="profile-panel-general"');
    expect(regularUserHtml).not.toContain('data-testid="profile-panel-security"');
    expect(regularUserHtml).not.toContain('data-testid="profile-admin-panel-link"');
  });
});
