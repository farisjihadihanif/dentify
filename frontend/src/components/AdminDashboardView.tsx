'use client';

import React, {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Newspaper,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { AppButton } from './AppButton';
import { ErrorBanner } from './ErrorBanner';
import {
  adminCreateArticle,
  adminDeleteArticle,
  adminDeleteUser,
  adminFetchArticles,
  adminFetchUsers,
  adminUpdateArticle,
  adminUpdateUserRole,
} from '../services/adminService';
import {
  ARTICLE_CATEGORIES,
  type ArticleCategory,
  type ArticleItem,
  type CoverFitMode,
} from '../services/articleService';
import {
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated,
  type AuthUser,
} from '../services/authService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';
import { compressImageFileToDataUrl } from '../utils/imageHelper';

export type AdminTabKey = 'articles' | 'users';

export interface AdminDashboardViewProps {
  initialUser?: AuthUser | null;
  initialTab?: AdminTabKey;
  initialArticles?: ArticleItem[];
  initialUsers?: AuthUser[];
}

interface ArticleFormState {
  id: string | null;
  title: string;
  category: ArticleCategory;
  coverImageUrl: string;
  coverFit: CoverFitMode;
  coverPosX: number;
  coverPosY: number;
  coverZoom: number;
  summary: string;
  content: string;
  authorName: string;
  isPublished: boolean;
}

const EMPTY_ARTICLE_FORM: ArticleFormState = {
  id: null,
  title: '',
  category: 'Berita',
  coverImageUrl: '',
  coverFit: 'contain',
  coverPosX: 50,
  coverPosY: 50,
  coverZoom: 1,
  summary: '',
  content: '',
  authorName: 'Tim Redaksi DentHub',
  isPublished: true,
};

function parseCoverPosition(pos?: string): { x: number; y: number } {
  if (!pos) return { x: 50, y: 50 };
  const parts = pos.trim().split(/\s+/);
  const parsePct = (token?: string) => {
    const num = Number.parseFloat((token || '').replace('%', ''));
    return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 50;
  };
  return { x: parsePct(parts[0]), y: parsePct(parts[1] ?? parts[0]) };
}

/**
 * Admin CMS & User Management Dashboard:
 * - Strictly accessible only when `user.role === 'admin'`; non-admins are redirected to `/`.
 * - Two tabs:
 *   1. `Kelola Berita, Promo & Artikel`: create, edit, publish/unpublish, and delete items with URL or image upload.
 *   2. `Kelola Akun Pengguna`: search users, switch `user` / `admin` role, and delete accounts (self-delete blocked).
 */
export function AdminDashboardView({
  initialUser = null,
  initialTab = 'articles',
  initialArticles,
  initialUsers,
}: AdminDashboardViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(
    initialUser ?? getStoredUser(),
  );
  const [isCheckingRole, setIsCheckingRole] = useState<boolean>(!initialUser);
  const [activeTab, setActiveTab] = useState<AdminTabKey>(initialTab);

  // Articles state
  const [articles, setArticles] = useState<ArticleItem[]>(initialArticles ?? []);
  const [isLoadingArticles, setIsLoadingArticles] = useState<boolean>(false);
  const [formState, setFormState] = useState<ArticleFormState>(EMPTY_ARTICLE_FORM);
  const [isSavingArticle, setIsSavingArticle] = useState<boolean>(false);
  const [isProcessingCover, setIsProcessingCover] = useState<boolean>(false);

  // Users state
  const [users, setUsers] = useState<AuthUser[]>(initialUsers ?? []);
  const [userSearch, setUserSearch] = useState<string>('');
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);

  // Feedback banners
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  const loadArticles = useCallback(async () => {
    setIsLoadingArticles(true);
    try {
      const items = await adminFetchArticles();
      setArticles(items);
    } catch (error) {
      setUiError(mapApiError(error));
    } finally {
      setIsLoadingArticles(false);
    }
  }, []);

  const loadUsers = useCallback(async (query?: string) => {
    setIsLoadingUsers(true);
    try {
      const list = await adminFetchUsers(query);
      setUsers(list);
    } catch (error) {
      setUiError(mapApiError(error));
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (initialUser) return;
    if (!isAuthenticated()) {
      router.replace('/');
      return;
    }

    let cancelled = false;
    setIsCheckingRole(true);
    void fetchCurrentUser()
      .then((fresh) => {
        if (cancelled) return;
        if (fresh.role !== 'admin') {
          router.replace('/');
          return;
        }
        setCurrentUser(fresh);
        setIsCheckingRole(false);
        if (!initialArticles) void loadArticles();
        if (!initialUsers) void loadUsers();
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialUser, initialArticles, initialUsers, loadArticles, loadUsers, router]);

  const handleCoverUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUiError(null);

    const mime = (file.type || '').toLowerCase();
    const isImage =
      ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'].includes(mime) ||
      mime.startsWith('image/') ||
      /\.(jpe?g|png|webp|svg|gif)$/i.test(file.name || '');

    if (!isImage) {
      setUiError(mapApiError('INVALID_IMAGE'));
      return;
    }

    setIsProcessingCover(true);
    try {
      // Automatically compress uploaded covers > 500 KB via HTML5 Canvas (<= 480 KB)
      const compressedDataUrl = await compressImageFileToDataUrl(file, 480 * 1024, 1440);
      setFormState((prev) => ({
        ...prev,
        coverImageUrl: compressedDataUrl,
        coverFit: prev.category === 'Promo' ? 'contain' : prev.coverFit,
      }));
    } catch {
      setUiError(mapApiError('INVALID_IMAGE'));
    } finally {
      setIsProcessingCover(false);
    }
  };

  const handleSubmitArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingArticle || isProcessingCover) return;

    setUiError(null);
    setStatusMessage(null);
    setIsSavingArticle(true);

    try {
      const cleanedCover = formState.coverImageUrl.trim();
      const payload = {
        title: formState.title.trim(),
        category: formState.category,
        coverImageUrl: cleanedCover || '/images/covers/artikel-default.svg',
        coverFit: formState.coverFit,
        coverPosition: `${formState.coverPosX}% ${formState.coverPosY}%`,
        coverZoom: formState.coverZoom,
        summary: formState.summary.trim(),
        content: formState.content.trim(),
        authorName: formState.authorName.trim() || 'Admin DentHub',
        isPublished: formState.isPublished,
      };

      if (formState.id) {
        const updated = await adminUpdateArticle(formState.id, payload);
        setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setStatusMessage('Konten berhasil diperbarui.');
      } else {
        const created = await adminCreateArticle(payload);
        setArticles((prev) => [created, ...prev]);
        setStatusMessage('Konten baru berhasil dibuat dan disimpan.');
      }
      setFormState(EMPTY_ARTICLE_FORM);
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleEditArticle = (article: ArticleItem) => {
    const pos = parseCoverPosition(article.coverPosition);
    setFormState({
      id: article.id,
      title: article.title,
      category: article.category,
      coverImageUrl: article.coverImageUrl || '',
      coverFit: article.coverFit === 'cover' ? 'cover' : 'contain',
      coverPosX: pos.x,
      coverPosY: pos.y,
      coverZoom: article.coverZoom ?? 1,
      summary: article.summary,
      content: article.content,
      authorName: article.authorName,
      isPublished: article.isPublished,
    });
    setStatusMessage(null);
    setUiError(null);
  };

  const handleTogglePublish = async (article: ArticleItem) => {
    setUiError(null);
    setStatusMessage(null);
    try {
      const updated = await adminUpdateArticle(article.id, {
        isPublished: !article.isPublished,
      });
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setStatusMessage(
        updated.isPublished
          ? `Konten "${updated.title}" kini dipublikasikan.`
          : `Konten "${updated.title}" dipindahkan ke draf.`,
      );
    } catch (error) {
      setUiError(mapApiError(error));
    }
  };

  const handleDeleteArticle = async (article: ArticleItem) => {
    setUiError(null);
    setStatusMessage(null);
    try {
      await adminDeleteArticle(article.id);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      if (formState.id === article.id) {
        setFormState(EMPTY_ARTICLE_FORM);
      }
      setStatusMessage(`Konten "${article.title}" berhasil dihapus.`);
    } catch (error) {
      setUiError(mapApiError(error));
    }
  };

  const handleSearchUsersSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadUsers(userSearch);
  };

  const handleRoleSwitch = async (user: AuthUser, nextRole: 'user' | 'admin') => {
    setUiError(null);
    setStatusMessage(null);
    try {
      const updated = await adminUpdateUserRole(user.id, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setStatusMessage(`Peran ${updated.full_name} diperbarui menjadi ${updated.role}.`);
    } catch (error) {
      setUiError(mapApiError(error));
    }
  };

  const handleDeleteUser = async (user: AuthUser) => {
    setUiError(null);
    setStatusMessage(null);
    try {
      await adminDeleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setStatusMessage(`Akun ${user.full_name} berhasil dihapus.`);
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    }
  };

  if (isCheckingRole) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-text-muted">
        Memverifikasi hak akses Admin DentHub...
      </main>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  const previewCoverSrc = formState.coverImageUrl.trim() || '/images/covers/artikel-default.svg';

  return (
    <main
      data-testid="admin-dashboard-workspace"
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10 pb-24 sm:px-6 sm:py-12 lg:px-8"
    >
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Panel Administrasi • Khusus Admin DentHub</span>
          </span>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-text sm:text-3xl">
            Admin CMS &amp; Manajemen Pengguna
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Kelola berita, promo, artikel kesehatan gigi, serta hak akses akun pengguna DentHub.
          </p>
        </div>

        <Link
          href="/berita"
          className="inline-flex h-10 items-center gap-2 self-start rounded-pill border border-border bg-surface px-4 text-xs font-bold text-brand-dark shadow-sm transition-colors hover:bg-brand-soft sm:self-auto"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Lihat Portal Berita Publik</span>
        </Link>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Tab Pengelolaan Admin"
        className="flex flex-wrap gap-2 rounded-card border border-border bg-surface p-2 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'articles'}
          data-testid="admin-tab-articles"
          onClick={() => setActiveTab('articles')}
          className={[
            'inline-flex h-10 min-h-touch items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors',
            activeTab === 'articles'
              ? 'bg-brand text-surface shadow-sm'
              : 'text-text-muted hover:bg-brand-soft hover:text-brand-dark',
          ].join(' ')}
        >
          <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Kelola Berita, Promo &amp; Artikel</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'users'}
          data-testid="admin-tab-users"
          onClick={() => setActiveTab('users')}
          className={[
            'inline-flex h-10 min-h-touch items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors',
            activeTab === 'users'
              ? 'bg-brand text-surface shadow-sm'
              : 'text-text-muted hover:bg-brand-soft hover:text-brand-dark',
          ].join(' ')}
        >
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Kelola Akun Pengguna</span>
        </button>
      </div>

      {uiError && <ErrorBanner error={uiError} onDismiss={() => setUiError(null)} />}

      {statusMessage && (
        <div
          role="status"
          data-testid="admin-status-banner"
          className="flex items-center gap-2 rounded-card border border-status-green bg-brand-soft p-4 text-xs font-semibold text-status-green sm:text-sm"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* =====================================================================
          TAB 1: KELOLA BERITA, PROMO & ARTIKEL
         ===================================================================== */}
      {activeTab === 'articles' && (
        <div
          data-testid="admin-panel-articles"
          className="grid items-start gap-6 lg:grid-cols-12"
        >
          {/* Left: Create / Edit Form */}
          <section className="rounded-card border border-border bg-surface p-6 shadow-sm lg:col-span-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-display text-lg font-bold text-text">
                {formState.id ? 'Edit Konten' : 'Buat Konten Baru'}
              </h2>
              {formState.id && (
                <button
                  type="button"
                  onClick={() => setFormState(EMPTY_ARTICLE_FORM)}
                  className="text-xs font-semibold text-brand-dark hover:underline"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => void handleSubmitArticle(e)}
              className="mt-5 space-y-4"
              noValidate
            >
              <div>
                <label
                  htmlFor="admin-article-title"
                  className="block text-xs font-semibold text-text"
                >
                  Judul Konten
                </label>
                <input
                  id="admin-article-title"
                  type="text"
                  required
                  value={formState.title}
                  onChange={(e) => setFormState((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Contoh: Promo Scaling Gigi Akhir Pekan"
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin-article-category"
                    className="block text-xs font-semibold text-text"
                  >
                    Kategori
                  </label>
                  <select
                    id="admin-article-category"
                    value={formState.category}
                    onChange={(e) =>
                      setFormState((p) => ({
                        ...p,
                        category: e.target.value as ArticleCategory,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm font-semibold text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                  >
                    {ARTICLE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="admin-article-author"
                    className="block text-xs font-semibold text-text"
                  >
                    Nama Penulis / Redaksi
                  </label>
                  <input
                    id="admin-article-author"
                    type="text"
                    value={formState.authorName}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, authorName: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="admin-article-cover"
                  className="block text-xs font-semibold text-text"
                >
                  Gambar Sampul (URL atau Unggah File — Otomatis Kompres &gt; 500 KB)
                </label>
                <div className="flex gap-2">
                  <input
                    id="admin-article-cover"
                    type="text"
                    value={formState.coverImageUrl}
                    onChange={(e) =>
                      setFormState((p) => ({ ...p, coverImageUrl: e.target.value }))
                    }
                    placeholder="Unggah gambar atau tempel URL (https://...)"
                    className="flex-1 rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                  />
                  <label
                    htmlFor="admin-article-cover-file"
                    className="inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-brand-soft px-3 text-xs font-bold text-brand-dark hover:bg-brand hover:text-surface"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{isProcessingCover ? 'Kompres...' : 'Unggah'}</span>
                    <input
                      id="admin-article-cover-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                      onChange={(e) => void handleCoverUpload(e)}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Live Cover Frame Preview & Fit/Position Adjuster */}
                <div
                  data-testid="admin-cover-frame-adjuster"
                  className="space-y-3 rounded-2xl border border-border bg-bg p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                      Pratinjau &amp; Penyesuaian Sampul
                    </span>
                    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        data-testid="cover-fit-contain-btn"
                        onClick={() => setFormState((p) => ({ ...p, coverFit: 'contain', coverZoom: 1 }))}
                        className={[
                          'inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
                          formState.coverFit === 'contain'
                            ? 'bg-brand text-surface'
                            : 'text-text-muted hover:text-text',
                        ].join(' ')}
                      >
                        <Minimize2 className="h-3 w-3" aria-hidden="true" />
                        <span>Pas Penuh (Utuh tanpa terpotong)</span>
                      </button>
                      <button
                        type="button"
                        data-testid="cover-fit-cover-btn"
                        onClick={() => setFormState((p) => ({ ...p, coverFit: 'cover' }))}
                        className={[
                          'inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors',
                          formState.coverFit === 'cover'
                            ? 'bg-brand text-surface'
                            : 'text-text-muted hover:text-text',
                        ].join(' ')}
                      >
                        <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        <span>Isi Frame (Cover)</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className={
                      formState.coverFit === 'contain'
                        ? 'relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-bg/80 p-3'
                        : 'relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-surface-navy'
                    }
                  >
                    <img
                      src={previewCoverSrc}
                      alt="Pratinjau sampul konten"
                      className={
                        formState.coverFit === 'contain'
                          ? 'mx-auto max-h-[260px] w-auto max-w-full rounded-lg object-contain transition-transform duration-150'
                          : 'h-full w-full object-cover transition-transform duration-150'
                      }
                      style={
                        formState.coverFit === 'cover'
                          ? {
                              objectPosition: `${formState.coverPosX}% ${formState.coverPosY}%`,
                              transform:
                                formState.coverZoom > 1 ? `scale(${formState.coverZoom})` : undefined,
                            }
                          : undefined
                      }
                    />
                  </div>

                  {formState.coverFit === 'cover' && (
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="admin-cover-zoom"
                          className="flex justify-between text-[11px] font-semibold text-text-muted"
                        >
                          <span>Zoom</span>
                          <span>{formState.coverZoom.toFixed(1)}x</span>
                        </label>
                        <input
                          id="admin-cover-zoom"
                          type="range"
                          min={1}
                          max={2.2}
                          step={0.1}
                          value={formState.coverZoom}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, coverZoom: Number(e.target.value) }))
                          }
                          className="mt-1 w-full accent-brand"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="admin-cover-pos-x"
                          className="flex justify-between text-[11px] font-semibold text-text-muted"
                        >
                          <span>Fokus X</span>
                          <span>{formState.coverPosX}%</span>
                        </label>
                        <input
                          id="admin-cover-pos-x"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={formState.coverPosX}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, coverPosX: Number(e.target.value) }))
                          }
                          className="mt-1 w-full accent-brand"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="admin-cover-pos-y"
                          className="flex justify-between text-[11px] font-semibold text-text-muted"
                        >
                          <span>Fokus Y</span>
                          <span>{formState.coverPosY}%</span>
                        </label>
                        <input
                          id="admin-cover-pos-y"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={formState.coverPosY}
                          onChange={(e) =>
                            setFormState((p) => ({ ...p, coverPosY: Number(e.target.value) }))
                          }
                          className="mt-1 w-full accent-brand"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-article-summary"
                  className="block text-xs font-semibold text-text"
                >
                  Ringkasan / Deskripsi Singkat (Tanpa Batas Karakter)
                </label>
                <textarea
                  id="admin-article-summary"
                  rows={3}
                  required
                  value={formState.summary}
                  onChange={(e) => setFormState((p) => ({ ...p, summary: e.target.value }))}
                  placeholder="Tulis ringkasan berita, promo, atau artikel bebas panjang..."
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-article-content"
                  className="block text-xs font-semibold text-text"
                >
                  Isi Konten Lengkap (Tanpa Batas Kata — Pisahkan Paragraf dengan Baris Kosong)
                </label>
                <textarea
                  id="admin-article-content"
                  rows={7}
                  required
                  value={formState.content}
                  onChange={(e) => setFormState((p) => ({ ...p, content: e.target.value }))}
                  placeholder="Tulis isi lengkap berita, promo, atau artikel edukasi gigi..."
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-text">
                <input
                  type="checkbox"
                  checked={formState.isPublished}
                  onChange={(e) =>
                    setFormState((p) => ({ ...p, isPublished: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand-ring"
                />
                <span>Publikasikan langsung ke halaman /berita &amp; pop-up promo</span>
              </label>

              <AppButton
                type="submit"
                variant="primary"
                size="md"
                loading={isSavingArticle || isProcessingCover}
                loadingText={isProcessingCover ? 'Memproses Sampul...' : 'Menyimpan...'}
                disabled={
                  formState.title.trim().length < 3 ||
                  formState.summary.trim().length < 1 ||
                  formState.content.trim().length < 1
                }
                className="w-full"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formState.id ? 'Simpan Perubahan Konten' : 'Terbitkan Konten'}</span>
              </AppButton>
            </form>
          </section>

          {/* Right: Published & Draft List */}
          <section className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-sm lg:col-span-7">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="font-display text-lg font-bold text-text">
                Daftar Konten ({articles.length})
              </h2>
              <span className="text-xs text-text-muted">Terbaru di atas</span>
            </div>

            {isLoadingArticles ? (
              <p className="py-8 text-center text-sm text-text-muted">Memuat daftar konten...</p>
            ) : articles.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                Belum ada berita, promo, atau artikel.
              </p>
            ) : (
              <div className="space-y-3">
                {articles.map((article) => (
                  <article
                    key={article.id}
                    data-testid={`admin-article-row-${article.slug}`}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-3.5 sm:flex-row sm:items-center"
                  >
                    <img
                      src={article.coverImageUrl || '/images/covers/artikel-default.svg'}
                      alt={article.title}
                      onError={(e) => {
                        if (!e.currentTarget.src.endsWith('/images/covers/artikel-default.svg')) {
                          e.currentTarget.src = '/images/covers/artikel-default.svg';
                        }
                      }}
                      className="h-20 w-16 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-pill bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-dark">
                          {article.category}
                        </span>
                        <span
                          className={[
                            'rounded-pill px-2.5 py-0.5 text-[11px] font-bold',
                            article.isPublished
                              ? 'bg-status-green/15 text-status-green'
                              : 'bg-surface-sand text-text',
                          ].join(' ')}
                        >
                          {article.isPublished ? 'Dipublikasikan' : 'Draf'}
                        </span>
                      </div>
                      <h3 className="truncate font-display text-sm font-bold text-text">
                        {article.title}
                      </h3>
                      <p className="line-clamp-1 text-xs text-text-muted">{article.summary}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditArticle(article)}
                        aria-label={`Edit ${article.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-brand-dark transition-colors hover:bg-brand-soft"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTogglePublish(article)}
                        aria-label={
                          article.isPublished
                            ? `Sembunyikan ${article.title}`
                            : `Publikasikan ${article.title}`
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-brand-soft"
                      >
                        {article.isPublished ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteArticle(article)}
                        aria-label={`Hapus ${article.title}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-status-red/30 bg-surface text-status-red transition-colors hover:bg-status-red/10"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =====================================================================
          TAB 2: KELOLA AKUN PENGGUNA
         ===================================================================== */}
      {activeTab === 'users' && (
        <section
          data-testid="admin-panel-users"
          className="space-y-5 rounded-card border border-border bg-surface p-6 shadow-sm"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-lg font-bold text-text">
                Daftar Akun Pengguna ({users.length})
              </h2>
              <p className="text-xs text-text-muted">
                Ubah peran pengguna (User / Admin) atau hapus akun yang tidak diperlukan.
              </p>
            </div>

            <form
              onSubmit={(e) => void handleSearchUsersSubmit(e)}
              className="flex w-full max-w-sm gap-2"
            >
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari nama, email, username..."
                  aria-label="Cari akun pengguna"
                  className="h-10 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-sm text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                />
              </div>
              <AppButton type="submit" variant="secondary" size="sm">
                Cari
              </AppButton>
            </form>
          </div>

          {isLoadingUsers ? (
            <p className="py-8 text-center text-sm text-text-muted">Memuat daftar pengguna...</p>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Tidak ada akun pengguna yang ditemukan.
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    data-testid={`admin-user-row-${user.id}`}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-bg p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-text">{user.full_name}</p>
                        <span
                          className={[
                            'rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase',
                            user.role === 'admin'
                              ? 'bg-brand text-surface'
                              : 'bg-brand-soft text-brand-dark',
                          ].join(' ')}
                        >
                          {user.role}
                        </span>
                        {isSelf && (
                          <span className="rounded-pill bg-surface-sand px-2 py-0.5 text-[11px] font-bold text-text">
                            Akun Anda
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-text-muted">
                        {user.email}
                        {user.username ? ` • @${user.username}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor={`role-select-${user.id}`} className="sr-only">
                        Peran untuk {user.full_name}
                      </label>
                      <select
                        id={`role-select-${user.id}`}
                        value={user.role}
                        disabled={isSelf}
                        onChange={(e) =>
                          void handleRoleSwitch(user, e.target.value as 'user' | 'admin')
                        }
                        className="h-9 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>

                      <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => void handleDeleteUser(user)}
                        aria-label={`Hapus akun ${user.full_name}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-status-red/30 bg-surface px-3 text-xs font-semibold text-status-red transition-colors hover:bg-status-red/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default AdminDashboardView;
