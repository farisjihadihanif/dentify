'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HIDDEN_ROUTES = ['/chat', '/login', '/register'];

/**
 * Maskot Interaktif "Deni" (`DeniMascot.tsx`) dengan logika & animasi seperti `lenteraumat.netlify.app`:
 * - Menggunakan gambar transparan `/images/deni-mascot.png` (dengan fallback SVG dokter gigi bila gagal muat)
 * - Animasi mengambang halus (floating bounce) di pojok kanan bawah layar
 * - Saat di-hover atau difokuskan, memunculkan gelembung teks **"Tanya Deni"**
 * - Saat diklik langsung mengarahkan pengguna ke halaman chat bersama Deni (`/chat`)
 * - Otomatis disembunyikan ketika pengguna sedang berada di `/chat`, `/login`, atau `/register`
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
        {/* Gelembung Teks "Tanya Deni" yang muncul saat di-hover */}
        <span
          data-testid="deni-mascot-tooltip"
          className={[
            'pointer-events-none whitespace-nowrap rounded-pill border border-brand bg-surface px-4 py-2 text-badge font-bold text-brand-dark shadow-lg transition-all duration-300',
            isHovered
              ? 'translate-x-0 scale-100 opacity-100'
              : 'translate-x-2 scale-95 opacity-0 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100',
          ].join(' ')}
        >
          💬 Tanya Deni
        </span>

        {/* Karakter Maskot Deni (Tanpa Background / Transparent PNG) */}
        <div className="animate-deni-float relative flex h-20 w-20 items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-110 sm:h-24 sm:w-24">
          <span
            aria-hidden="true"
            className="absolute inset-2 rounded-pill bg-brand/20 blur-md transition-opacity group-hover:opacity-100"
          />
          {!imageError ? (
            <img
              src="/images/deni-mascot.png"
              alt="Maskot Deni — Asisten Kesehatan Gigi DentHub"
              onError={() => setImageError(true)}
              className="relative z-10 h-full w-full select-none object-contain drop-shadow-xl"
            />
          ) : (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-pill border-2 border-brand bg-brand-soft text-screen-title shadow-md">
              🦷
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export default DeniMascot;
