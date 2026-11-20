'use client';

import React, { useState } from 'react';

export interface DentHubLogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  className?: string;
}

/**
 * Logo resmi DentHub (`DentHubLogo.tsx`):
 * - Memakai aset `/images/denthub-logo.png` (ikon garis gigi biru dengan cincin orbit miring di bawah).
 * - Bila aset gagal dimuat, otomatis memakai SVG vektor dengan identitas yang sama (`#0284C7` / `#0369A1`).
 */
export function DentHubLogo({
  size = 34,
  showText = true,
  textClassName = 'text-base font-extrabold tracking-tight text-brand-dark',
  className = '',
}: DentHubLogoProps) {
  const [useFallback, setUseFallback] = useState(false);

  return (
    <span
      data-testid="denthub-logo"
      className={['inline-flex items-center gap-2 select-none', className].filter(Boolean).join(' ')}
    >
      {!useFallback ? (
        <img
          src="/images/denthub-logo.png"
          alt="Logo DentHub"
          width={size}
          height={size}
          onError={() => setUseFallback(true)}
          className="shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="shrink-0"
        >
          <path
            d="M21 15C16.2 15 13 19.2 13 24.5C13 30.8 16.2 35.8 18.4 42.2C19.6 45.8 20.6 50 23.2 50C25.5 50 26.8 45.5 28.4 41.2C29.4 38.6 30.6 37.5 32 37.5C33.4 37.5 34.6 38.6 35.6 41.2C37.2 45.5 38.5 50 40.8 50C43.4 50 44.4 45.8 45.6 42.2C47.8 35.8 51 30.8 51 24.5C51 19.2 47.8 15 43 15C39.2 15 36.2 17.6 32 17.6C27.8 17.6 24.8 15 21 15Z"
            stroke="var(--color-brand)"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 35.5C6.5 39.2 6.8 44.2 13.5 47.2C22.4 51.2 38.8 50.2 49.5 44.6C56.8 40.8 58.5 35.4 53 32.2"
            stroke="var(--color-brand-ring)"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
        </svg>
      )}

      {showText && <span className={textClassName}>DentHub</span>}
    </span>
  );
}

export default DentHubLogo;
