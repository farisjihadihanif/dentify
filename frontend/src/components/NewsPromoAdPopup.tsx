'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { fetchPublishedArticles, type ArticleItem } from '../services/articleService';

export interface NewsPromoAdPopupProps {
  initialArticle?: ArticleItem | null;
  pathnameOverride?: string;
}

export function isAdPopupExcludedPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (pathname.startsWith('/berita/')) return true;
  return false;
}

/**
 * Automatic Ad-Style News & Promo Pop-Up:
 * - Automatically appears on page load whenever at least one published item exists
 *   from `GET /api/v1/articles` (excluding `/admin` and `/berita/[slug]`).
 * - Showcases cover image, category badge, title, close button (`×`), and CTA to open the full article.
 */
export function NewsPromoAdPopup({
  initialArticle = null,
  pathnameOverride,
}: NewsPromoAdPopupProps) {
  const hookPathname = usePathname() || '/';
  const pathname = pathnameOverride ?? hookPathname;

  const [featuredArticle, setFeaturedArticle] = useState<ArticleItem | null>(initialArticle);
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(initialArticle));

  const excluded = isAdPopupExcludedPath(pathname);

  useEffect(() => {
    if (initialArticle || excluded) return;
    let cancelled = false;

    void fetchPublishedArticles()
      .then((items) => {
        if (cancelled || !items.length) return;
        const promoFirst = items.find((item) => item.category === 'Promo') ?? items[0];
        setFeaturedArticle(promoFirst);
        setIsOpen(true);
      })
      .catch(() => {
        // Silently skip pop-up if backend is unreachable
      });

    return () => {
      cancelled = true;
    };
  }, [initialArticle, excluded]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (excluded || !isOpen || !featuredArticle) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ad-popup-title"
      data-testid="news-promo-ad-popup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-navy/70 p-4 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Tutup pop-up promo"
          data-testid="ad-popup-close-btn"
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-surface text-text opacity-100 shadow-md transition-transform hover:scale-105 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Ad Poster Cover Image */}
        <div
          className={[
            'relative aspect-[16/10] w-full overflow-hidden',
            featuredArticle.coverFit === 'contain' ? 'bg-slate-100 p-2' : 'bg-surface-navy',
          ].join(' ')}
        >
          <img
            src={featuredArticle.coverImageUrl || '/images/covers/artikel-default.svg'}
            alt={featuredArticle.title}
            onError={(e) => {
              if (!e.currentTarget.src.endsWith('/images/covers/artikel-default.svg')) {
                e.currentTarget.src = '/images/covers/artikel-default.svg';
              }
            }}
            className={[
              'h-full w-full',
              featuredArticle.coverFit === 'contain' ? 'object-contain' : 'object-cover',
            ].join(' ')}
            style={
              featuredArticle.coverFit !== 'contain'
                ? { objectPosition: featuredArticle.coverPosition || '50% 50%' }
                : undefined
            }
          />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-surface-sand px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-text shadow-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{featuredArticle.category}</span>
          </span>
        </div>

        {/* Body & CTAs */}
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <h2
              id="ad-popup-title"
              className="font-display text-xl font-extrabold leading-snug text-text"
            >
              {featuredArticle.title}
            </h2>
            <p className="line-clamp-3 text-sm leading-relaxed text-text-muted">
              {featuredArticle.summary}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Link
              href={`/berita/${featuredArticle.slug}`}
              onClick={() => setIsOpen(false)}
              data-testid="ad-popup-cta-read"
              className="inline-flex h-11 min-h-cta flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-bold text-surface shadow-sm transition-colors hover:bg-brand-dark"
            >
              <span>Baca Selengkapnya</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>

            <Link
              href="/berita"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 min-h-touch items-center justify-center whitespace-nowrap rounded-xl border border-border bg-bg px-4 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft"
            >
              Lihat Semua
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewsPromoAdPopup;
