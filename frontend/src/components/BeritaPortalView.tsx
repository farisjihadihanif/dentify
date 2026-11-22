'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Check,
  Newspaper,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import {
  ARTICLE_CATEGORIES,
  fetchPublishedArticles,
  getOrderedCategories,
  type ArticleCategory,
  type ArticleItem,
} from '../services/articleService';

export interface BeritaPortalViewProps {
  initialArticles?: ArticleItem[];
  initialCategory?: ArticleCategory;
  initialPreviewArticle?: ArticleItem | null;
  initialDropdownOpen?: boolean;
}

const DEFAULT_COVER_IMAGE = '/images/covers/artikel-default.svg';

const CATEGORY_DESCRIPTIONS: Record<ArticleCategory, string> = {
  Berita:
    'Kabar terbaru seputar inovasi teknologi skrining gigi, kesehatan masyarakat, dan pembaruan Dentify.',
  Promo:
    'Penawaran pemeriksaan rutin, voucher scaling mitra RSGM, dan program edukasi preventif Dentify.',
  Artikel:
    'Panduan edukasi perawatan gigi harian dan kesehatan rongga mulut berbasis referensi klinis.',
};

const CATEGORY_ICONS: Record<ArticleCategory, React.ComponentType<{ className?: string }>> = {
  Berita: Newspaper,
  Promo: Sparkles,
  Artikel: BookOpen,
};

/**
 * News, Promo & Articles Digital-Library Portal (`BeritaPortalView.tsx`):
 * - Section 1: Horizontally centered `max-w-2xl` search bar + custom styled accessible
 *   category dropdown menu (`Berita`, `Promo`, `Artikel`) with no native browser arrow.
 * - Sections 2, 3, & 4 (`Berita`, `Promo`, `Artikel`): dynamically reordered so the selected
 *   category moves to the top, each featuring an H2 heading and a horizontal scrollable shelf
 *   of vertical book/magazine cards showing ONLY cover image and title.
 * - Step 1 Preview Modal: always-visible `×` close button, cover image with fallback, category
 *   badge, title, summary, and prominent `Baca Selengkapnya` link to `/berita/[slug]`.
 */
export function BeritaPortalView({
  initialArticles,
  initialCategory = 'Berita',
  initialPreviewArticle = null,
  initialDropdownOpen = false,
}: BeritaPortalViewProps) {
  const [articles, setArticles] = useState<ArticleItem[]>(initialArticles ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!initialArticles);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<ArticleCategory>(initialCategory);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState<boolean>(initialDropdownOpen);
  const [previewArticle, setPreviewArticle] = useState<ArticleItem | null>(initialPreviewArticle);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialArticles) return;
    let cancelled = false;
    setIsLoading(true);
    void fetchPublishedArticles()
      .then((items) => {
        if (!cancelled) setArticles(items);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialArticles]);

  useEffect(() => {
    if (!previewArticle && !isCategoryMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewArticle) setPreviewArticle(null);
        if (isCategoryMenuOpen) setIsCategoryMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isCategoryMenuOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [previewArticle, isCategoryMenuOpen]);

  const orderedCategories = useMemo(
    () => getOrderedCategories(selectedCategory),
    [selectedCategory],
  );

  const filteredByCategory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matches = q
      ? articles.filter(
          (item) =>
            item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q),
        )
      : articles;

    const grouped: Record<ArticleCategory, ArticleItem[]> = {
      Berita: [],
      Promo: [],
      Artikel: [],
    };

    for (const item of matches) {
      if (grouped[item.category]) {
        grouped[item.category].push(item);
      }
    }
    return grouped;
  }, [articles, searchQuery]);

  const ActiveCategoryIcon = CATEGORY_ICONS[selectedCategory];

  return (
    <main
      data-testid="berita-portal-page"
      className="mx-auto w-full max-w-7xl space-y-12 px-4 py-10 pb-24 sm:px-6 sm:py-12 lg:px-8"
    >
      {/* =====================================================================
          SECTION 1: Centered Search Bar + Custom Styled Category Dropdown
         ===================================================================== */}
      <section
        aria-labelledby="heading-berita-portal"
        data-testid="berita-section-1-search"
        className="space-y-6 text-center"
      >
        <div className="mx-auto max-w-2xl space-y-2.5">
          <h1
            id="heading-berita-portal"
            className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl"
          >
            Berita, Promo &amp; Artikel Kesehatan Gigi
          </h1>
          <p className="text-sm text-text-muted sm:text-base">
            Temukan informasi terbaru, penawaran layanan klinik mitra, serta artikel edukasi
            perawatan gigi dalam tampilan rak pustaka digital.
          </p>
        </div>

        {/* Centered Search Bar + Custom Accessible Category Menu Immediately to its Right */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <label htmlFor="berita-search-input" className="sr-only">
              Cari berita, promo, atau artikel gigi
            </label>
            <input
              id="berita-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul atau ringkasan berita, promo, artikel..."
              data-testid="berita-search-input"
              className="h-12 w-full rounded-pill border border-border bg-surface pl-11 pr-4 text-sm text-text shadow-sm transition-colors placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
          </div>

          <div ref={dropdownRef} className="relative shrink-0">
            <button
              type="button"
              id="berita-category-trigger"
              aria-haspopup="listbox"
              aria-expanded={isCategoryMenuOpen}
              aria-label="Prioritaskan Kategori"
              data-testid="berita-category-select"
              onClick={() => setIsCategoryMenuOpen((prev) => !prev)}
              className="inline-flex h-12 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-brand px-6 py-3 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <ActiveCategoryIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{selectedCategory}</span>
            </button>

            {isCategoryMenuOpen && (
              <div
                role="listbox"
                aria-labelledby="berita-category-trigger"
                data-testid="berita-category-menu"
                className="absolute right-0 top-full z-30 mt-2 min-w-[180px] rounded-2xl border border-border bg-surface p-1.5 text-left shadow-xl"
              >
                {ARTICLE_CATEGORIES.map((category) => {
                  const Icon = CATEGORY_ICONS[category];
                  const isActive = category === selectedCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-testid={`berita-category-option-${category.toLowerCase()}`}
                      onClick={() => {
                        setSelectedCategory(category);
                        setIsCategoryMenuOpen(false);
                      }}
                      className={[
                        'flex w-full items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-brand-soft font-semibold text-brand-dark'
                          : 'font-medium text-text hover:bg-bg hover:text-brand-dark',
                      ].join(' ')}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{category}</span>
                      </span>
                      {isActive && (
                        <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTIONS 2, 3, & 4: Dynamically Ordered Horizontal Digital-Library Shelves
         ===================================================================== */}
      {orderedCategories.map((category, sectionIdx) => {
        const shelfItems = filteredByCategory[category];
        return (
          <section
            key={category}
            aria-labelledby={`heading-shelf-${category.toLowerCase()}`}
            data-testid={`berita-shelf-${category.toLowerCase()}`}
            data-shelf-order={sectionIdx + 2}
            className="space-y-4"
          >
            <div className="flex flex-col justify-between gap-1 border-b border-border pb-3 sm:flex-row sm:items-end">
              <div>
                <h2
                  id={`heading-shelf-${category.toLowerCase()}`}
                  className="font-display text-2xl font-extrabold text-text"
                >
                  {category}
                </h2>
                <p className="mt-0.5 text-sm text-text-muted">
                  {CATEGORY_DESCRIPTIONS[category]}
                </p>
              </div>
              <span className="text-xs font-semibold text-brand-dark">
                {shelfItems.length} terbitan
              </span>
            </div>

            {isLoading ? (
              <div className="flex gap-4 overflow-x-auto pb-3">
                {[1, 2, 3].map((slot) => (
                  <div
                    key={slot}
                    className="h-72 w-48 shrink-0 animate-pulse rounded-card border border-border bg-surface sm:w-56"
                  />
                ))}
              </div>
            ) : shelfItems.length > 0 ? (
              <div
                data-testid={`berita-shelf-track-${category.toLowerCase()}`}
                className="flex gap-4 overflow-x-auto pb-3"
              >
                {shelfItems.map((article) => {
                  const isPosterCover =
                    article.coverFit === 'contain' ||
                    (!article.coverFit && article.category === 'Promo');
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => setPreviewArticle(article)}
                      data-testid={`berita-card-${article.slug}`}
                      className="group flex w-48 shrink-0 cursor-pointer flex-col overflow-hidden rounded-card border border-border bg-surface text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:w-56"
                    >
                      <div
                        className={[
                          'aspect-[3/4] w-full overflow-hidden',
                          isPosterCover ? 'bg-bg/80 p-1.5' : 'bg-surface-navy',
                        ].join(' ')}
                      >
                        <img
                          src={article.coverImageUrl || DEFAULT_COVER_IMAGE}
                          alt={article.title}
                          onError={(e) => {
                            if (!e.currentTarget.src.endsWith(DEFAULT_COVER_IMAGE)) {
                              e.currentTarget.src = DEFAULT_COVER_IMAGE;
                            }
                          }}
                          className={[
                            'h-full w-full transition-transform duration-300 group-hover:scale-105',
                            isPosterCover ? 'object-contain' : 'object-cover',
                          ].join(' ')}
                          style={
                            !isPosterCover
                              ? { objectPosition: article.coverPosition || '50% 50%' }
                              : undefined
                          }
                        />
                      </div>
                      <div className="p-3.5">
                        <h3 className="line-clamp-3 font-display text-sm font-bold leading-snug text-text group-hover:text-brand-dark">
                          {article.title}
                        </h3>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-card border border-border bg-surface p-6 text-center text-sm text-text-muted">
                Tidak ada konten pada kategori {category} yang cocok dengan pencarian Anda.
              </div>
            )}
          </section>
        );
      })}

      {/* =====================================================================
          STEP 1 PREVIEW MODAL (Click Card -> Preview -> Baca Selengkapnya)
         ===================================================================== */}
      {previewArticle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          data-testid="berita-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-navy/70 p-4 backdrop-blur-sm"
          onClick={() => setPreviewArticle(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewArticle(null)}
              aria-label="Tutup pratinjau artikel"
              data-testid="berita-preview-close"
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-pill border border-border bg-surface text-text opacity-100 shadow-md transition-transform hover:scale-105 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div
              data-testid="berita-preview-media-frame"
              className="relative flex w-full items-center justify-center overflow-hidden bg-bg/80 p-3 sm:p-4"
            >
              <img
                src={previewArticle.coverImageUrl || DEFAULT_COVER_IMAGE}
                alt={previewArticle.title}
                onError={(e) => {
                  if (!e.currentTarget.src.endsWith(DEFAULT_COVER_IMAGE)) {
                    e.currentTarget.src = DEFAULT_COVER_IMAGE;
                  }
                }}
                className="mx-auto max-h-[340px] w-auto max-w-full rounded-xl object-contain sm:max-h-[400px]"
              />
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-pill bg-surface-sand px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-text shadow-sm">
                {previewArticle.category === 'Promo' ? (
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{previewArticle.category}</span>
              </span>
            </div>

            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h2
                  id="preview-modal-title"
                  className="font-display text-xl font-extrabold leading-snug text-text sm:text-2xl"
                >
                  {previewArticle.title}
                </h2>
                <p className="text-sm leading-relaxed text-text-muted">
                  {previewArticle.summary}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setPreviewArticle(null)}
                  className="inline-flex h-11 min-h-touch items-center justify-center rounded-xl border border-border bg-bg px-4 text-sm font-semibold text-text transition-colors hover:bg-brand-soft"
                >
                  Tutup
                </button>
                <Link
                  href={`/berita/${previewArticle.slug}`}
                  data-testid="berita-preview-read-more"
                  className="inline-flex h-11 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-bold text-surface shadow-sm transition-colors hover:bg-brand-dark"
                >
                  <span>Baca Selengkapnya</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default BeritaPortalView;
