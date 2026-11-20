'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const HIDDEN_ROUTES = ['/chat', '/login', '/register'];

/**
 * Floating Deni Mascot (docs/DESIGN.md §0 & §8.1).
 * Uses lucide-react icons (no emoji icons) and avoids decorative glow blobs.
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
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end"
    >
      <Link
        href="/chat"
        aria-label="Tanya Deni — Konsultasi dengan Asisten AI Deni"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className="group relative flex items-center gap-3 focus:outline-none"
      >
        <span
          data-testid="deni-mascot-tooltip"
          className={[
            'pointer-events-none inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-accent-deni bg-surface px-4 py-2 text-badge font-bold text-accent-deni shadow-md transition-all duration-300',
            isHovered
              ? 'translate-x-0 scale-100 opacity-100'
              : 'translate-x-2 scale-95 opacity-0 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100',
          ].join(' ')}
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Tanya Deni</span>
        </span>

        <div className="animate-deni-float relative flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-105 sm:h-24 sm:w-24">
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
