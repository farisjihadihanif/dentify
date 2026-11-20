'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Tag, User2 } from 'lucide-react';
import { fetchArticleBySlug, type ArticleItem } from '../services/articleService';

export interface BeritaArticleDetailViewProps {
  slug: string;
  initialArticle?: ArticleItem | null;
}

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

/**
 * Step 2 Full-Page Newspaper / Article Reader (`BeritaArticleDetailView.tsx`, docs/DESIGN.md §3.7):
 * - Full-width editorial cover image
 * - Category badge, headline title, publish date & author metadata
 * - Multi-paragraph formatted article body
 * - Clear navigation back to `/berita`
 */
export function BeritaArticleDetailView({
  slug,
  initialArticle = null,
}: BeritaArticleDetailViewProps) {
  const [article, setArticle] = useState<ArticleItem | null>(initialArticle);
  const [isLoading, setIsLoading] = useState<boolean>(!initialArticle);
  const [notFound, setNotFound] = useState<boolean>(false);

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

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 pb-24 sm:px-6 lg:px-8">
        <div className="h-6 w-40 animate-pulse rounded-pill bg-border/60" />
        <div className="h-12 w-3/4 animate-pulse rounded-xl bg-border/60" />
        <div className="aspect-[16/9] w-full animate-pulse rounded-[1.75rem] bg-border/60" />
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

  return (
    <main
      data-testid="berita-detail-page"
      className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 pb-24 sm:px-6 sm:py-12 lg:px-8"
    >
      <div>
        <Link
          href="/berita"
          data-testid="berita-detail-back-link"
          className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-xs font-bold text-brand-dark shadow-sm transition-colors hover:bg-brand-soft"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Kembali ke Portal Berita &amp; Promo</span>
        </Link>
      </div>

      <article className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm">
        {/* Full-Width Cover Header */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-navy">
          <img
            src={article.coverImageUrl || '/images/covers/artikel-default.svg'}
            alt={article.title}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('/images/covers/artikel-default.svg')) {
                e.currentTarget.src = '/images/covers/artikel-default.svg';
              }
            }}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Newspaper Editorial Header & Body */}
        <div className="space-y-6 p-6 sm:p-10">
          <header className="space-y-4 border-b border-border pb-6">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-extrabold uppercase tracking-wider text-brand-dark">
              <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{article.category}</span>
            </span>

            <h1 className="font-display text-2xl font-extrabold leading-tight text-text sm:text-4xl">
              {article.title}
            </h1>

            <p className="text-base font-medium leading-relaxed text-text-muted">
              {article.summary}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-semibold text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <User2 className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
                <span>{article.authorName || 'Tim Redaksi DentHub'}</span>
              </span>
              <span aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
                <span>{formatPublishedDate(article.publishedAt)}</span>
              </span>
            </div>
          </header>

          <div
            data-testid="berita-detail-body"
            className="space-y-5 text-base leading-8 text-text"
          >
            {paragraphs.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            <Link
              href="/berita"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-bg px-4 text-xs font-bold text-brand-dark transition-colors hover:bg-brand-soft"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Jelajahi Berita &amp; Promo Lainnya</span>
            </Link>
            <Link
              href="/scan"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-xs font-bold text-surface transition-colors hover:bg-brand-dark"
            >
              <span>Coba AI Dental Scan Gratis</span>
            </Link>
          </footer>
        </div>
      </article>
    </main>
  );
}

export default BeritaArticleDetailView;
