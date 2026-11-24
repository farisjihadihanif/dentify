'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircleHeart,
  Share2,
  Sparkles,
  Tag,
  User2,
} from 'lucide-react';
import {
  fetchArticleBySlug,
  fetchPublishedArticles,
  type ArticleItem,
} from '../services/articleService';

export interface BeritaArticleDetailViewProps {
  slug: string;
  initialArticle?: ArticleItem | null;
  initialRelatedArticles?: ArticleItem[];
  initialCoverNaturalSize?: { width: number; height: number } | null;
}

const DEFAULT_COVER_IMAGE = '/images/covers/artikel-default.svg';

function formatPublishedDate(iso: string | null): string {
  if (!iso) return 'Terbitan Terbaru';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Publication-Grade Editorial Post Detail Page (`/berita/[slug]`):
 * - Wide `max-w-[1280px]` editorial layout with breadcrumb, bold headline, lead deck, metadata,
 *   reading time, and one-click share button
 * - Full uncropped hero media stage honoring saved `coverFit`, `coverPosition`, and `coverZoom`
 * - 2-column desktop layout (`lg:grid-cols-12`): spacious article body + sticky sidebar with related posts & CTAs.
 */
export function BeritaArticleDetailView({
  slug,
  initialArticle = null,
  initialRelatedArticles,
  initialCoverNaturalSize,
}: BeritaArticleDetailViewProps) {
  const [article, setArticle] = useState<ArticleItem | null>(initialArticle);
  const [relatedArticles, setRelatedArticles] = useState<ArticleItem[]>(
    initialRelatedArticles ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialArticle);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [coverNaturalSize, setCoverNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(initialCoverNaturalSize ?? null);
  const coverImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (initialCoverNaturalSize !== undefined) {
      setCoverNaturalSize(initialCoverNaturalSize);
      return;
    }
    const img = coverImgRef.current;
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      setCoverNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    } else {
      setCoverNaturalSize(null);
    }
  }, [article?.coverImageUrl, initialCoverNaturalSize]);

  useEffect(() => {
    if (initialArticle) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void fetchArticleBySlug(slug)
      .then((item) => {
        if (!cancelled) setArticle(item);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, initialArticle]);

  useEffect(() => {
    if (initialRelatedArticles) return;
    let cancelled = false;

    void fetchPublishedArticles()
      .then((items) => {
        if (cancelled) return;
        const filtered = items.filter((item) => item.slug !== slug).slice(0, 5);
        setRelatedArticles(filtered);
      })
      .catch(() => {
        // Keep empty related list if unavailable
      });

    return () => {
      cancelled = true;
    };
  }, [slug, initialRelatedArticles]);

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      setCopiedLink(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1280px] space-y-6 px-4 py-10 pb-24 sm:px-6 lg:px-8">
        <div className="h-5 w-64 animate-pulse rounded-pill bg-border/60" />
        <div className="h-14 w-3/4 animate-pulse rounded-xl bg-border/60" />
        <div className="aspect-[16/9] w-full animate-pulse rounded-3xl bg-border/60" />
      </main>
    );
  }

  if (notFound || !article) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-16 pb-24 text-center sm:px-6">
        <h1 className="font-display text-2xl font-extrabold text-text sm:text-3xl">
          Artikel Tidak Ditemukan
        </h1>
        <p className="text-sm text-text-muted">
          Konten yang Anda cari mungkin telah dihapus atau belum dipublikasikan.
        </p>
        <div>
          <Link
            href="/berita"
            className="inline-flex h-11 min-h-cta items-center gap-2 rounded-pill bg-brand px-5 text-sm font-bold text-surface transition-colors hover:bg-brand-dark"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Kembali ke Berita &amp; Promo</span>
          </Link>
        </div>
      </main>
    );
  }

  const paragraphs = article.content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const readMinutes = estimateReadingMinutes(article.content);
  const isWideLandscape =
    coverNaturalSize !== null &&
    coverNaturalSize.width > 0 &&
    coverNaturalSize.height > 0 &&
    coverNaturalSize.width > coverNaturalSize.height;
  const useWideCoverMode = article.coverFit === 'cover' && isWideLandscape;
  const coverPosition = article.coverPosition || '50% 50%';
  const coverZoom = article.coverZoom && article.coverZoom > 1 ? article.coverZoom : 1;
  const isPromo = article.category === 'Promo';

  return (
    <main
      data-testid="berita-detail-page"
      className="mx-auto w-full max-w-[1280px] space-y-8 px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:px-8"
    >
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        data-testid="berita-detail-breadcrumb"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <ol className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-text-muted">
          <li>
            <Link
              href="/"
              className="inline-flex min-h-touch items-center transition-colors hover:text-brand-dark"
            >
              Beranda
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li>
            <Link
              href="/berita"
              data-testid="berita-detail-back-link"
              className="inline-flex min-h-touch items-center transition-colors hover:text-brand-dark"
            >
              Portal Berita &amp; Promo
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="font-bold text-brand-dark">{article.category}</li>
        </ol>

        <button
          type="button"
          onClick={() => void handleCopyLink()}
          data-testid="berita-share-copy-btn"
          className="inline-flex h-9 min-h-touch items-center gap-1.5 rounded-pill border border-border bg-surface px-4 text-xs font-bold text-text shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark"
        >
          {copiedLink ? (
            <>
              <Check className="h-3.5 w-3.5 text-status-green" aria-hidden="true" />
              <span className="text-status-green">Tautan Disalin!</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Salin Tautan</span>
            </>
          )}
        </button>
      </nav>

      {/* Publication Editorial Header */}
      <header className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-dark">
            {isPromo ? (
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{article.category}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted">
            <Clock className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
            <span>{readMinutes} menit baca</span>
          </span>
        </div>

        <h1 className="max-w-5xl font-display text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-4xl lg:text-5xl">
          {article.title}
        </h1>

        <p className="max-w-4xl text-base font-medium leading-relaxed text-text-muted sm:text-lg">
          {article.summary}
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold text-text-muted sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <User2 className="h-4 w-4 text-brand-dark" aria-hidden="true" />
            <span className="text-text">{article.authorName || 'Tim Redaksi Dentify'}</span>
          </span>
          <span aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-brand-dark" aria-hidden="true" />
            <span>{formatPublishedDate(article.publishedAt)}</span>
          </span>
        </div>
      </header>

      {/* Full Uncropped Hero Media Stage (auto-detects vertical/square images) */}
      <figure
        data-testid="berita-hero-media-stage"
        className={
          useWideCoverMode
            ? 'overflow-hidden rounded-card border border-border bg-surface-navy shadow-sm'
            : 'flex justify-center overflow-hidden rounded-card border border-border bg-bg/80 p-4 shadow-sm sm:p-6'
        }
      >
        {useWideCoverMode ? (
          <div className="max-h-[460px] w-full overflow-hidden">
            <img
              ref={coverImgRef}
              src={article.coverImageUrl || DEFAULT_COVER_IMAGE}
              alt={article.title}
              onLoad={(e) => {
                const { naturalWidth, naturalHeight } = e.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) {
                  setCoverNaturalSize({ width: naturalWidth, height: naturalHeight });
                }
              }}
              onError={(e) => {
                if (!e.currentTarget.src.endsWith(DEFAULT_COVER_IMAGE)) {
                  e.currentTarget.src = DEFAULT_COVER_IMAGE;
                }
              }}
              className="max-h-[460px] w-full object-cover"
              style={{
                objectPosition: coverPosition,
                transform: coverZoom > 1 ? `scale(${coverZoom})` : undefined,
              }}
            />
          </div>
        ) : (
          <img
            ref={coverImgRef}
            src={article.coverImageUrl || DEFAULT_COVER_IMAGE}
            alt={article.title}
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setCoverNaturalSize({ width: naturalWidth, height: naturalHeight });
              }
            }}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(DEFAULT_COVER_IMAGE)) {
                e.currentTarget.src = DEFAULT_COVER_IMAGE;
              }
            }}
            className="mx-auto max-h-[540px] w-auto max-w-full rounded-xl object-contain"
          />
        )}
      </figure>

      {/* 2-Column Desktop Editorial Layout (8 + 4) */}
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Main Article Column (8 cols) */}
        <article className="space-y-8 rounded-[1.75rem] border border-border bg-surface p-6 shadow-sm sm:p-10 lg:col-span-8">
          <div
            data-testid="berita-detail-body"
            className="space-y-5 text-base leading-8 text-text sm:text-[17px]"
          >
            {paragraphs.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          {/* Dedicated Promo Info & Claim Card */}
          {isPromo && (
            <section
              data-testid="berita-promo-claim-card"
              className="space-y-4 rounded-2xl border border-brand/30 bg-brand-soft p-6"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-brand-dark" aria-hidden="true" />
                <h2 className="font-display text-lg font-extrabold text-text">
                  Info &amp; Klaim Promo Layanan Gigi
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-text-muted">
                Ingin memanfaatkan penawaran ini atau menanyakan syarat dan lokasi klinik mitra
                terdekat? Gunakan Clinic Finder Dentify atau tanyakan langsung kepada asisten AI
                Deni.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/clinics"
                  className="inline-flex h-10 min-h-cta items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-surface shadow-sm transition-colors hover:bg-brand-dark"
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Cari Klinik Mitra Terdekat</span>
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex h-10 min-h-touch items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-bold text-brand-dark transition-colors hover:bg-bg"
                >
                  <MessageCircleHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Tanya Deni Mengenai Promo</span>
                </Link>
              </div>
            </section>
          )}

          {/* Editorial Attribution & Footer */}
          <div className="rounded-2xl border border-border bg-bg p-4 text-sm leading-relaxed text-text-muted">
            <strong className="font-bold text-text">Catatan Redaksi Dentify: </strong>
            Konten ini disusun untuk tujuan informasi dan edukasi kesehatan gigi preventif. Untuk
            diagnosis medis maupun tindakan klinis, selalu konsultasikan langsung dengan dokter
            gigi berizin.
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <Link
              href="/berita"
              className="inline-flex min-h-touch w-full items-center justify-center gap-2 whitespace-nowrap sm:w-auto rounded-xl border border-border bg-bg px-4 text-sm font-bold text-brand-dark transition-colors hover:bg-brand-soft"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Kembali ke Portal Berita &amp; Promo</span>
            </Link>
            <Link
              href="/scan"
              className="inline-flex min-h-touch w-full items-center justify-center gap-2 whitespace-nowrap sm:w-auto rounded-xl bg-brand px-4 text-sm font-bold text-surface transition-colors hover:bg-brand-dark"
            >
              <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Coba AI Dental Scan Gratis</span>
            </Link>
          </footer>
        </article>

        {/* Sticky Right Sidebar (4 cols) */}
        <aside
          aria-label="Konten Terkait dan Akses Cepat Dentify"
          data-testid="berita-detail-sidebar"
          className="space-y-6 lg:sticky lg:top-8 lg:col-span-4"
        >
          {/* Related Posts */}
          <section className="space-y-4 rounded-[1.5rem] border border-border bg-surface p-5 shadow-sm">
            <h2 className="border-b border-border pb-3 font-display text-lg font-extrabold text-text">
              Berita, Artikel &amp; Promo Lainnya
            </h2>

            {relatedArticles.length > 0 ? (
              <ul className="space-y-3.5">
                {relatedArticles.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/berita/${item.slug}`}
                      className="group flex items-start gap-3 rounded-xl p-1.5 transition-colors hover:bg-brand-soft/60"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-slate-100">
                        <img
                          src={item.coverImageUrl || DEFAULT_COVER_IMAGE}
                          alt={item.title}
                          onError={(e) => {
                            if (!e.currentTarget.src.endsWith(DEFAULT_COVER_IMAGE)) {
                              e.currentTarget.src = DEFAULT_COVER_IMAGE;
                            }
                          }}
                          className={[
                            'h-full w-full',
                            item.coverFit === 'contain' ||
                            (!item.coverFit && item.category === 'Promo')
                              ? 'object-contain p-0.5'
                              : 'object-cover',
                          ].join(' ')}
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-block rounded-pill bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-dark">
                          {item.category}
                        </span>
                        <p className="line-clamp-2 text-sm font-bold leading-snug text-text transition-colors group-hover:text-brand-dark">
                          {item.title}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">
                Jelajahi berbagai artikel dan promo terbaru lainnya di Portal Berita Dentify.
              </p>
            )}

            <div className="pt-1">
              <Link
                href="/berita"
                className="inline-flex min-h-touch w-full items-center justify-center rounded-xl border border-border bg-bg text-sm font-bold text-brand-dark transition-colors hover:bg-brand-soft"
              >
                Lihat Semua Terbitan →
              </Link>
            </div>
          </section>

          {/* Quick Action Screening & Consultation Card */}
          <section className="space-y-4 rounded-[1.5rem] border border-brand/25 bg-brand-soft p-5 shadow-sm">
            <h2 className="font-display text-lg font-extrabold text-text">
              Skrining &amp; Konsultasi Dentify
            </h2>
            <p className="text-sm leading-relaxed text-text-muted">
              Periksa kondisi gigi Anda secara mandiri lewat AI Dental Scan atau konsultasikan
              keluhan gigi harian bersama asisten AI Deni.
            </p>
            <div className="flex flex-col gap-2.5">
              <Link
                href="/scan"
                className="inline-flex h-10 min-h-cta items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-surface shadow-sm transition-colors hover:bg-brand-dark"
              >
                <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Mulai AI Dental Scan</span>
              </Link>
              <Link
                href="/chat"
                className="inline-flex h-10 min-h-touch items-center justify-center gap-2 rounded-xl bg-accent-deni px-4 text-xs font-bold text-surface shadow-sm transition-opacity hover:opacity-95"
              >
                <MessageCircleHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tanya Asisten AI Deni</span>
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default BeritaArticleDetailView;
