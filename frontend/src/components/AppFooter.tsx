'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Newspaper } from 'lucide-react';

export interface AppFooterProps {
  pathnameOverride?: string;
}

/**
 * Flush bottom responsive global footer (`AppFooter.tsx`):
 * - Hidden on `/chat` so the consultation workspace fills 100dvh cleanly
 * - Uses high-contrast dark-navy (`bg-surface-navy`) styling on `/panduan` only
 * - Desktop (`md:` and up): left credits stacked above `Denthub © 2026`, right `Panduan Aplikasi`
 *   stacked above `Promo, Berita & Artikel`
 * - Mobile (`< md`): generous bottom clearance (`pb-24 sm:pb-28 md:pb-4`) above the floating dock.
 */
export function AppFooter({ pathnameOverride }: AppFooterProps = {}) {
  const hookPathname = usePathname() || '/';
  const pathname = pathnameOverride ?? hookPathname;

  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return null;
  }

  const isPanduan = pathname === '/panduan' || pathname.startsWith('/panduan/');

  return (
    <footer
      data-testid="app-footer"
      data-theme={isPanduan ? 'navy' : 'default'}
      className={[
        'mt-auto w-full border-t pb-24 pt-4 text-xs sm:pb-28 md:pb-4',
        isPanduan
          ? 'border-white/15 bg-surface-navy text-slate-200'
          : 'border-border/70 bg-bg/95 text-text-muted',
      ].join(' ')}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:items-center md:gap-6 lg:px-8">
        <div
          data-testid="footer-left-credits"
          className="flex flex-col items-center gap-1 text-center md:items-start md:text-left"
        >
          <p className={isPanduan ? 'font-medium text-slate-200' : 'font-medium text-text'}>
            created by{' '}
            <strong
              className={
                isPanduan ? 'font-semibold text-white' : 'font-semibold text-brand-dark'
              }
            >
              Faris Jihadi Hanif Lubis
            </strong>
          </p>
          <p
            className={
              isPanduan ? 'font-semibold text-slate-200' : 'font-semibold text-text-muted'
            }
          >
            Denthub &copy; 2026
          </p>
        </div>

        <div
          data-testid="footer-right-links"
          className="flex flex-col items-center gap-2 md:items-end"
        >
          <Link
            href="/panduan"
            className={[
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 text-xs font-semibold transition-colors',
              isPanduan
                ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white'
                : 'bg-brand-soft text-brand-dark hover:bg-brand hover:text-surface',
            ].join(' ')}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Panduan Aplikasi</span>
          </Link>
          <Link
            href="/berita"
            className={[
              'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 text-xs font-semibold transition-colors',
              isPanduan
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white'
                : 'border-border bg-surface text-brand-dark hover:border-brand hover:bg-brand-soft',
            ].join(' ')}
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
