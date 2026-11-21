'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanLine, MessageCircleHeart, MapPin, UserCircle2 } from 'lucide-react';
import { DentHubLogo } from './DentHubLogo';

export interface NavDockItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface FloatingNavbarProps {
  pathnameOverride?: string;
}

export const NAV_DOCK_ITEMS: readonly NavDockItem[] = [
  { label: 'Scan', href: '/scan', icon: ScanLine },
  { label: 'Deni', href: '/chat', icon: MessageCircleHeart },
  { label: 'Klinik', href: '/clinics', icon: MapPin },
  { label: 'Profil', href: '/profile', icon: UserCircle2 },
];

/**
 * Floating Navigation Dock (`FloatingNavbar.tsx`):
 * - On `/chat` ONLY: renders vertically anchored on the right edge of the viewport
 *   (`fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-2 rounded-3xl p-2 shadow-xl`)
 *   so it never overlaps the bottom chat composer.
 * - On all other routes: horizontal bottom-center floating dock (`bottom-5 sm:bottom-6 z-50`).
 */
export function FloatingNavbar({ pathnameOverride }: FloatingNavbarProps = {}) {
  const hookPathname = usePathname() || '/';
  const pathname = pathnameOverride ?? hookPathname;
  const isHomeActive = pathname === '/';
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  if (isChatRoute) {
    return (
      <nav
        aria-label="Navigasi Utama DentHub"
        data-testid="floating-navbar"
        data-orientation="vertical-right"
        className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-3xl border border-border/90 bg-surface/95 p-2 shadow-xl backdrop-blur-md"
      >
        <Link
          href="/"
          aria-label="Beranda DentHub"
          title="Beranda DentHub"
          aria-current={isHomeActive ? 'page' : undefined}
          data-testid="navbar-logo-home-link"
          className={[
            'inline-flex h-11 w-11 min-h-touch min-w-touch items-center justify-center rounded-2xl transition-all duration-150',
            isHomeActive
              ? 'bg-brand-soft ring-2 ring-brand-ring'
              : 'hover:bg-brand-soft/80',
          ].join(' ')}
        >
          <DentHubLogo size={26} showText={false} />
        </Link>

        <span className="h-px w-7 bg-border" aria-hidden="true" />

        <ul className="flex flex-col items-center gap-1.5">
          {NAV_DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={[
                    'flex min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10px] font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-brand text-surface shadow-sm'
                      : 'text-text-muted hover:bg-brand-soft hover:text-brand-dark',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-3 sm:bottom-6">
      <nav
        aria-label="Navigasi Utama DentHub"
        data-testid="floating-navbar"
        data-orientation="horizontal-bottom"
        className="pointer-events-auto flex items-center gap-1 rounded-pill border border-border/90 bg-surface/95 px-2 py-1.5 shadow-md backdrop-blur-md sm:gap-1.5 sm:px-3"
      >
        <Link
          href="/"
          aria-label="Beranda DentHub"
          aria-current={isHomeActive ? 'page' : undefined}
          data-testid="navbar-logo-home-link"
          className={[
            'inline-flex h-9 min-h-touch min-w-touch items-center justify-center rounded-pill px-2.5 transition-all duration-150 sm:px-3',
            isHomeActive
              ? 'bg-brand-soft ring-2 ring-brand-ring'
              : 'hover:bg-brand-soft/80',
          ].join(' ')}
        >
          <DentHubLogo size={26} showText className="gap-1.5" />
        </Link>

        <span className="h-5 w-px bg-border" aria-hidden="true" />

        <ul className="flex items-center gap-1">
          {NAV_DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={[
                    'inline-flex h-9 min-h-touch min-w-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold transition-all duration-150 sm:px-3.5 sm:text-sm',
                    isActive
                      ? 'bg-brand text-surface shadow-sm'
                      : 'text-text-muted hover:bg-brand-soft hover:text-brand-dark',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

export default FloatingNavbar;
