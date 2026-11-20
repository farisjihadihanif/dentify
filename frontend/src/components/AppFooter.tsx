import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Compact global footer on every page (`AppFooter.tsx`, docs/DESIGN.md §0):
 * - Slim height (`py-3`) with clean bottom clearance (`pb-20`) for the bottom-center floating navbar
 * - Left  : `created by Faris Jihadi Hanif Lubis`
 * - Center: `Denthub 2026©`
 * - Right : Link to Panduan Aplikasi (`/panduan`)
 */
export function AppFooter() {
  return (
    <footer
      data-testid="app-footer"
      className="mt-auto border-t border-border bg-surface pb-20 text-xs text-text-muted"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row sm:px-6 lg:px-8">
        <p className="font-medium text-text">
          created by <strong className="font-semibold text-brand-dark">Faris Jihadi Hanif Lubis</strong>
        </p>

        <p className="font-semibold text-text">Denthub 2026&copy;</p>

        <Link
          href="/panduan"
          className="inline-flex h-9 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-pill bg-brand-soft px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Panduan Aplikasi</span>
        </Link>
      </div>
    </footer>
  );
}

export default AppFooter;
