import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

/**
 * Footer global di setiap halaman (`AppFooter.tsx`):
 * - Paling kiri : `created by Faris Jihadi Hanif Lubis`
 * - Tengah      : `Denthub 2026©`
 * - Paling kanan: Link navigasi menuju halaman Panduan Aplikasi (`/panduan`)
 */
export function AppFooter() {
  return (
    <footer
      data-testid="app-footer"
      className="mt-auto border-t border-border bg-surface pb-24 text-badge text-text-muted"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
        <p className="font-medium text-text">
          created by <strong className="font-semibold text-brand-dark">Faris Jihadi Hanif Lubis</strong>
        </p>

        <p className="font-semibold text-text">
          Denthub 2026&copy;
        </p>

        <Link
          href="/panduan"
          className="inline-flex min-h-touch items-center gap-2 rounded-pill bg-brand-soft px-4 py-2 font-semibold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
        >
          <BookOpen className="h-4 w-4" />
          <span>Panduan Aplikasi</span>
        </Link>
      </div>
    </footer>
  );
}

export default AppFooter;
