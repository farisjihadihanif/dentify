'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

export interface DentalInstrumentSpec {
  id: string;
  label: string;
  tooltip: string;
  href: '/scan' | '/panduan';
  angleDeg: number;
  tone: 'primary' | 'accent';
}

export interface OrbitRingSpec {
  id: string;
  diameterCss: string;
  ringAnimClass: string;
  counterAnimClass: string;
  instruments: readonly DentalInstrumentSpec[];
}

export const CONCENTRIC_ORBIT_RINGS: readonly OrbitRingSpec[] = [
  {
    id: 'orbit-ring-1',
    diameterCss: 'clamp(360px, 76vmin, 520px)',
    ringAnimClass: 'animate-orbit-cw-60',
    counterAnimClass: 'animate-orbit-ccw-60',
    instruments: [
      {
        id: 'mouth-mirror',
        label: 'Kaca Mulut',
        tooltip: 'Kaca Mulut • Pemeriksaan Visual',
        href: '/scan',
        angleDeg: 0,
        tone: 'accent',
      },
      {
        id: 'anatomical-molar',
        label: 'Gigi Molar Sehat',
        tooltip: 'Molar Sehat • Screening Preventif',
        href: '/scan',
        angleDeg: 180,
        tone: 'primary',
      },
    ],
  },
  {
    id: 'orbit-ring-2',
    diameterCss: 'clamp(490px, 102vmin, 700px)',
    ringAnimClass: 'animate-orbit-ccw-75',
    counterAnimClass: 'animate-orbit-cw-75',
    instruments: [
      {
        id: 'dental-explorer',
        label: 'Sonde Gigi',
        tooltip: 'Sonde Diagnostik • Deteksi Karies',
        href: '/scan',
        angleDeg: 42,
        tone: 'primary',
      },
      {
        id: 'periodontal-scaler',
        label: 'Scaler Periodontal',
        tooltip: 'Scaler Periodontal • Pembersih Karang Gigi',
        href: '/scan',
        angleDeg: 222,
        tone: 'accent',
      },
    ],
  },
  {
    id: 'orbit-ring-3',
    diameterCss: 'clamp(620px, 128vmin, 880px)',
    ringAnimClass: 'animate-orbit-cw-90',
    counterAnimClass: 'animate-orbit-ccw-90',
    instruments: [
      {
        id: 'dental-pliers',
        label: 'Pinset Gigi',
        tooltip: 'Pinset Klinis • Presisi Perawatan',
        href: '/panduan',
        angleDeg: 132,
        tone: 'accent',
      },
      {
        id: 'dental-handpiece',
        label: 'Handpiece Bor Gigi',
        tooltip: 'Handpiece Turbin • Perawatan Gigi',
        href: '/panduan',
        angleDeg: 312,
        tone: 'primary',
      },
    ],
  },
  {
    id: 'orbit-ring-4',
    diameterCss: 'clamp(750px, 154vmin, 1060px)',
    ringAnimClass: 'animate-orbit-ccw-105',
    counterAnimClass: 'animate-orbit-cw-105',
    instruments: [
      {
        id: 'extraction-forceps',
        label: 'Tang Pencabut Gigi',
        tooltip: 'Tang Ekstraksi • Bedah Oral',
        href: '/panduan',
        angleDeg: 18,
        tone: 'primary',
      },
      {
        id: 'carpule-syringe',
        label: 'Suntik Anestesi Lokal',
        tooltip: 'Spuit Anestesi • Kontrol Nyeri',
        href: '/panduan',
        angleDeg: 198,
        tone: 'accent',
      },
    ],
  },
] as const;

const INSTRUMENT_SVG_CLASS = 'h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16';

function renderDentalInstrumentSvg(id: string) {
  switch (id) {
    /* 1. Kaca Mulut (Dental Mouth Mirror) — bold angled mirror head with solid bevel & ergonomic grip */
    case 'mouth-mirror':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <ellipse
            cx="43"
            cy="20"
            rx="12"
            ry="9.5"
            transform="rotate(-36 43 20)"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.85"
          />
          <ellipse
            cx="43"
            cy="20"
            rx="7.5"
            ry="5.6"
            transform="rotate(-36 43 20)"
            stroke="currentColor"
            strokeWidth="1.4"
            opacity="0.65"
          />
          <path
            d="M34.2 28.8L12.5 50.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M23.5 39.5L14 49"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M39.5 16.5C41.8 15.2 44.6 15.4 46.5 16.8"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 2. Sonde Diagnostik (Dental Explorer / Probe) — double-ended diagnostic hook & graduated grip */
    case 'dental-explorer':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M21 43L42 22"
            stroke="currentColor"
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M42 22L48.5 15.5C51.4 12.6 55.6 13.6 56.2 17.4C56.7 20.4 54.1 23.2 51.2 23.5"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 43L13.5 50.5L9.2 48.2"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="51.2" cy="23.5" r="1.4" fill="currentColor" />
          <path
            d="M27.5 36.5L30 39M32.5 31.5L35 34M37.5 26.5L40 29"
            stroke="var(--color-bg)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 3. Pinset Klinis (Dental Cotton Pliers / Tweezers) — angled stainless clinical forceps */
    case 'dental-pliers':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M12.5 51.5L39.5 26L52.5 21.5L35 19L12.5 51.5Z"
            fill="currentColor"
            fillOpacity="0.12"
          />
          <path
            d="M12.5 51.5L39.5 26L52.5 21.8"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12.5 51.5L33.5 19.5L49 14.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22.5 40.5L27 35.5M26 36.8L30.2 32"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
          <circle cx="13.2" cy="50.8" r="2.6" fill="currentColor" />
        </svg>
      );

    /* 4. Scaler Periodontal (Dental Scaler / Curette) — ergonomic handle & curved sickle scaling tip */
    case 'periodontal-scaler':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M19.5 44.5L42.5 21.5"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
          />
          <path
            d="M42.5 21.5L48.5 15.5C51.6 12.4 54.4 10.6 56 12.4C57.4 13.9 55.2 18.2 52 20.8L46.5 23.2"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.5 44.5L14 50C11.8 52.2 9.8 52.8 8.8 51C8.1 49.6 9.6 46.8 12.4 45.4"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M26 38L36 28"
            stroke="var(--color-bg)"
            strokeWidth="1.6"
            strokeDasharray="2.5 3"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 5. Handpiece Turbin (Dental Turbine Handpiece) — bold contra-angle body, turbine head & bur */
    case 'dental-handpiece':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M10.5 47.5L35 29.5L44.5 25"
            stroke="currentColor"
            strokeWidth="5.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="43"
            y="18.2"
            width="9"
            height="10.2"
            rx="2.6"
            transform="rotate(-22 43 18.2)"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="1.85"
          />
          <path
            d="M49 28.4L53.4 40"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M53.4 40L54.6 43.2"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M16.5 43.2L23.5 38"
            stroke="var(--color-bg)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 6. Tang Ekstraksi (Dental Extraction Forceps) — hinged anatomical beaks & contoured handles */
    case 'extraction-forceps':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M14 51.5C20.5 46 27.5 39 33.8 30.8C37.8 25.4 41.2 19 48.2 14.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M21.5 55C26.8 47.8 31 39.8 34.6 31.8C38.6 26.4 45.2 23.6 52 20.8"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle
            cx="34.2"
            cy="31.2"
            r="3.8"
            fill="var(--color-bg)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="34.2" cy="31.2" r="1.4" fill="currentColor" />
          <path
            d="M48.2 14.5C51.2 13.4 53.2 15.2 52.2 17.8"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 7. Spuit Anestesi (Dental Carpule Syringe) — thumb-ring aspirating syringe with carpule window */
    case 'carpule-syringe':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <circle cx="13.5" cy="50.5" r="4.8" stroke="currentColor" strokeWidth="2.1" />
          <path
            d="M17.2 46.8L24.5 39.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M20.5 35.5L28.5 43.5"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <rect
            x="26"
            y="32.2"
            width="20"
            height="8.6"
            rx="2.2"
            transform="rotate(-45 26 32.2)"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.85"
          />
          <path
            d="M32.5 31.5L38 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M43 21L54.8 9.2"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 8. Molar Sehat (Anatomical Molar Silhouette) — sculptural dual-cusp crown & roots */
    case 'anatomical-molar':
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M21.2 13.5C15.8 13.5 12 18.2 12.8 24.8C13.5 31.4 16.4 35.8 17.8 42.6C18.8 47.4 20 52 23.2 52C26 52 27.2 46 29.4 41.8C30.4 39.8 33.6 39.8 34.6 41.8C36.8 46 38 52 40.8 52C44 52 45.2 47.4 46.2 42.6C47.6 35.8 50.5 31.4 51.2 24.8C52 18.2 48.2 13.5 42.8 13.5C39 13.5 35.8 15.8 32 15.8C28.2 15.8 25 13.5 21.2 13.5Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          <path
            d="M24.2 22.5C27.2 24.4 29.8 25 32 25C34.2 25 36.8 24.4 39.8 22.5"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinecap="round"
          />
          <path
            d="M32 25V29.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );
  }
}

/**
 * Home Hero Concentric Dental Instrument Orbit (`ConcentricDentalOrbit.tsx`, docs/DESIGN.md §3.1):
 * - 4 thin circular concentric orbit rings (`pointer-events-none`) centered behind the hero headline
 * - 8 large (48px–64px), bold, frameless interactive `<motion.button>` dental instrument silhouettes
 *   (ZERO boxes, ZERO rounded squares, ZERO borders, ZERO card backgrounds, ZERO drop-shadow glows)
 * - Hover scales to 1.25, brightens contrast, and shows a floating clinical tooltip pill;
 *   click navigates cleanly to `/scan` or `/panduan` with tactile spring tap feedback.
 */
export function ConcentricDentalOrbit() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      data-testid="concentric-dental-orbit"
      className="pointer-events-none relative h-full w-full overflow-hidden select-none"
    >
      <div
        data-testid="dentist-3d-canvas"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {/* Subtle central radial focal-zone fade behind rings so hero copy stays crisp */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(circle at center, var(--color-bg) 0%, var(--color-bg) 20%, transparent 48%)',
          }}
        />

        {CONCENTRIC_ORBIT_RINGS.map((ring) => (
          <div
            key={ring.id}
            data-testid={ring.id}
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ width: ring.diameterCss, height: ring.diameterCss }}
          >
            <div
              className={[
                'pointer-events-none relative h-full w-full rounded-full border',
                ring.ringAnimClass,
              ].join(' ')}
              style={{ borderColor: 'var(--color-orbit-ring)' }}
            >
              {ring.instruments.map((tool) => {
                const rad = (tool.angleDeg * Math.PI) / 180;
                const leftPct = +(50 + 50 * Math.cos(rad)).toFixed(4);
                const topPct = +(50 + 50 * Math.sin(rad)).toFixed(4);

                return (
                  <div
                    key={tool.id}
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 hover:z-30 focus-within:z-30"
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  >
                    <div className={['pointer-events-none', ring.counterAnimClass].join(' ')}>
                      <motion.button
                        type="button"
                        onClick={() => router.push(tool.href)}
                        data-testid={`orbit-tool-${tool.id}`}
                        data-instrument={tool.label}
                        data-tooltip={tool.tooltip}
                        aria-label={tool.tooltip}
                        whileHover={prefersReducedMotion ? undefined : { scale: 1.25 }}
                        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                        className="group pointer-events-auto relative inline-flex cursor-pointer items-center justify-center bg-transparent p-1 opacity-75 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none dark:text-[#BAE6FD] dark:hover:text-white"
                        style={{
                          color:
                            tool.tone === 'accent'
                              ? 'var(--color-orbit-tool-accent)'
                              : 'var(--color-orbit-tool-primary)',
                        }}
                      >
                        {renderDentalInstrumentSvg(tool.id)}

                        <span
                          role="tooltip"
                          className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-pill border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-tight text-text opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-[#1E3552] dark:bg-[#132842] dark:text-[#F8FAFC]"
                        >
                          {tool.tooltip}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConcentricDentalOrbit;
