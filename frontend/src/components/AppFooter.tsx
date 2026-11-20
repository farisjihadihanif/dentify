import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Flush bottom slim global footer (`AppFooter.tsx`, docs/DESIGN.md §0):
 * - Sits flush at the very bottom edge of the page with zero white gap underneath
 * - Far left : `created by Faris Jihadi Hanif Lubis`
 * - Far right: `Denthub 2026©` + link to Panduan Aplikasi (`/panduan`)
 * - Center remains naturally clear for the bottom-center floating navbar.
 */
export function AppFooter() {
  return (
    <footer
      data-testid="app-footer"
      className="mt-auto w-full border-t border-border/70 bg-bg/90 py-3 text-xs text-text-muted"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <p className="font-medium text-text">
          created by{' '}
          <strong className="font-semibold text-brand-dark">Faris Jihadi Hanif Lubis</strong>
        </p>

        <div className="flex items-center gap-3">
          <p className="font-semibold text-text">Denthub 2026&copy;</p>
          <Link
            href="/panduan"
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill bg-brand-soft px-3 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Panduan Aplikasi</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
