'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const HIDDEN_ROUTES = ['/chat', '/login', '/register'];

/**
 * Floating Deni Mascot (docs/DESIGN.md §0 & §8.1).
 * Subtle idle float animation + "Tanya Deni" tooltip positioned above Deni with a playful bounce.
 */
export function DeniMascot() {
  const pathname = usePathname() || '/';
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const shouldHide = HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (shouldHide) {
    return null;
  }

  return (
    <div
      data-testid="deni-mascot-widget"
      className="fixed bottom-24 right-4 z-50 flex flex-col items-end sm:bottom-24 sm:right-6"
    >
      <Link
        href="/chat"
        aria-label="Tanya Deni — Konsultasi dengan Asisten AI Deni"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className="group relative flex flex-col items-center focus:outline-none"
      >
        <span
          data-testid="deni-mascot-tooltip"
          className={[
            'pointer-events-none absolute bottom-full right-0 mb-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-accent-deni bg-surface px-3.5 py-1.5 text-badge font-bold text-accent-deni shadow-md transition-all duration-200',
            isHovered
              ? 'animate-deni-tooltip-bounce scale-100 opacity-100'
              : 'translate-y-1 scale-95 opacity-0 group-hover:animate-deni-tooltip-bounce group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
          ].join(' ')}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Tanya Deni</span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-accent-deni bg-surface"
          />
        </span>

        <div className="animate-deni-float relative flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-105 sm:h-24 sm:w-24">
          {!imageError ? (
            <img
              src="/images/deni-mascot.png"
              alt="Maskot Deni — Asisten Kesehatan Gigi DentHub"
              onError={() => setImageError(true)}
              className="relative z-10 h-full w-full select-none object-contain drop-shadow-md"
            />
          ) : (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-pill border-2 border-accent-deni bg-accent-deni-soft text-accent-deni shadow-md">
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export default DeniMascot;
