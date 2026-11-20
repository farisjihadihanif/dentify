'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScanLine, MessageCircleHeart, MapPin, UserCircle2 } from 'lucide-react';
import { DentHubLogo } from './DentHubLogo';

export interface NavDockItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_DOCK_ITEMS: readonly NavDockItem[] = [
  { label: 'Beranda', href: '/', icon: Home },
  { label: 'Scan', href: '/scan', icon: ScanLine },
  { label: 'Deni', href: '/chat', icon: MessageCircleHeart },
  { label: 'Klinik', href: '/clinics', icon: MapPin },
  { label: 'Profil', href: '/profile', icon: UserCircle2 },
];

/**
 * Floating Bottom-Center Dock (`FloatingNavbar.tsx`, docs/DESIGN.md §0):
 * - Fixed at bottom-center (`fixed inset-x-0 bottom-5 sm:bottom-6 z-50`) with subtle glassmorphism
 * - Uses official `DentHubLogo` (blue tooth outline with tilted orbital ring)
 * - Contains exactly 5 items: Beranda (`/`), Scan (`/scan`), Deni (`/chat`),
 *   Klinik (`/clinics`), and Profil (`/profile`).
 */
export function FloatingNavbar() {
  const pathname = usePathname() || '/';

  return (
    <header className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-3 sm:bottom-6">
      <nav
        aria-label="Navigasi Utama DentHub"
        data-testid="floating-navbar"
        className="pointer-events-auto flex items-center gap-1 rounded-pill border border-border/90 bg-surface/95 px-2.5 py-1.5 shadow-md backdrop-blur-md sm:gap-1.5 sm:px-4"
      >
        <Link
          href="/"
          aria-label="Beranda DentHub"
          className="hidden items-center pr-2 sm:inline-flex"
        >
          <DentHubLogo size={30} showText />
        </Link>

        <ul className="flex items-center gap-1">
          {NAV_DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={[
                    'inline-flex h-9 min-h-touch min-w-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-xs font-semibold transition-all duration-150 sm:px-3.5 sm:text-sm',
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
