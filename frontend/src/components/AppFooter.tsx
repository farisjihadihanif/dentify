import React from 'react';
import Link from 'next/link';
import { BookOpen, Newspaper } from 'lucide-react';

/**
 * Flush bottom responsive global footer (`AppFooter.tsx`):
 * - Desktop (`md:` and up):
 *   - Far left : `created by Faris Jihadi Hanif Lubis` stacked above `Denthub © 2026`
 *   - Far right: `Panduan Aplikasi` (`/panduan`) stacked above `Promo, Berita & Artikel` (`/berita`)
 *   - Center remains naturally clear for the bottom-center floating navbar.
 * - Mobile (`< md`): generous bottom clearance (`pb-24 sm:pb-28 md:pb-4`) so credits and links
 *   stack cleanly above the fixed floating bottom navigation bar with 100% visibility.
 */
export function AppFooter() {
  return (
    <footer
      data-testid="app-footer"
      className="mt-auto w-full border-t border-border/70 bg-bg/95 pb-24 pt-4 text-xs text-text-muted sm:pb-28 md:pb-4"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:items-center md:gap-6 lg:px-8">
        <div
          data-testid="footer-left-credits"
          className="flex flex-col items-center gap-1 text-center md:items-start md:text-left"
        >
          <p className="font-medium text-text">
            created by{' '}
            <strong className="font-semibold text-brand-dark">Faris Jihadi Hanif Lubis</strong>
          </p>
          <p className="font-semibold text-text-muted">Denthub &copy; 2026</p>
        </div>

        <div
          data-testid="footer-right-links"
          className="flex flex-col items-center gap-2 md:items-end"
        >
          <Link
            href="/panduan"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill bg-brand-soft px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Panduan Aplikasi</span>
          </Link>
          <Link
            href="/berita"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-surface px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-soft"
          >
            <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Promo, Berita &amp; Artikel</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
