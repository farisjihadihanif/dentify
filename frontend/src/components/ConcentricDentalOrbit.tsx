'use client';

import React from 'react';

export interface DentalInstrumentSpec {
  id: string;
  label: string;
  angleDeg: number;
  tone: 'primary' | 'accent';
  opacityClass: string;
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
    ringAnimClass: 'animate-orbit-cw-55',
    counterAnimClass: 'animate-orbit-ccw-55',
    instruments: [
      {
        id: 'mouth-mirror',
        label: 'Kaca Mulut',
        angleDeg: 0,
        tone: 'accent',
        opacityClass: 'opacity-80',
      },
      {
        id: 'anatomical-molar',
        label: 'Gigi Molar Sehat',
        angleDeg: 180,
        tone: 'primary',
        opacityClass: 'opacity-75',
      },
    ],
  },
  {
    id: 'orbit-ring-2',
    diameterCss: 'clamp(490px, 102vmin, 700px)',
    ringAnimClass: 'animate-orbit-ccw-70',
    counterAnimClass: 'animate-orbit-cw-70',
    instruments: [
      {
        id: 'dental-explorer',
        label: 'Sonde Gigi',
        angleDeg: 42,
        tone: 'primary',
        opacityClass: 'opacity-75',
      },
      {
        id: 'periodontal-scaler',
        label: 'Scaler Periodontal',
        angleDeg: 222,
        tone: 'accent',
        opacityClass: 'opacity-80',
      },
    ],
  },
  {
    id: 'orbit-ring-3',
    diameterCss: 'clamp(620px, 128vmin, 880px)',
    ringAnimClass: 'animate-orbit-cw-85',
    counterAnimClass: 'animate-orbit-ccw-85',
    instruments: [
      {
        id: 'dental-pliers',
        label: 'Pinset Gigi',
        angleDeg: 132,
        tone: 'accent',
        opacityClass: 'opacity-75',
      },
      {
        id: 'dental-handpiece',
        label: 'Handpiece Bor Gigi',
        angleDeg: 312,
        tone: 'primary',
        opacityClass: 'opacity-75',
      },
    ],
  },
  {
    id: 'orbit-ring-4',
    diameterCss: 'clamp(750px, 154vmin, 1060px)',
    ringAnimClass: 'animate-orbit-ccw-100',
    counterAnimClass: 'animate-orbit-cw-100',
    instruments: [
      {
        id: 'extraction-forceps',
        label: 'Tang Pencabut Gigi',
        angleDeg: 18,
        tone: 'primary',
        opacityClass: 'opacity-70',
      },
      {
        id: 'carpule-syringe',
        label: 'Suntik Anestesi Lokal',
        angleDeg: 198,
        tone: 'accent',
        opacityClass: 'opacity-75',
      },
    ],
  },
] as const;

function renderDentalInstrumentSvg(id: string) {
  switch (id) {
    /* 1. Kaca Mulut (Dental Mouth Mirror) — angled circular mirror head on slender clinical handle */
    case 'mouth-mirror':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <ellipse
            cx="32"
            cy="15"
            rx="8.5"
            ry="6.8"
            transform="rotate(-36 32 15)"
            stroke="currentColor"
            strokeWidth="2.1"
          />
          <ellipse
            cx="32"
            cy="15"
            rx="5.2"
            ry="3.9"
            transform="rotate(-36 32 15)"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.55"
          />
          <path
            d="M25.5 21.5L9.5 37.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M17.5 29.5L11.5 35.5"
            stroke="currentColor"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <path
            d="M29.8 12.2C31.2 11.4 33.1 11.5 34.4 12.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      );

    /* 2. Sonde Gigi (Dental Explorer / Probe) — double-ended diagnostic probe with shepherd's hook */
    case 'dental-explorer':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M16.5 31.5L30.5 17.5"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
          <path
            d="M30.5 17.5L35.2 12.8C37.2 10.8 40.3 11.4 40.8 14.1C41.2 16.2 39.4 18.2 37.4 18.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16.5 31.5L11.2 36.8L8.2 35.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 27L22.5 28.5M24.5 23.5L26 25"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      );

    /* 3. Pinset Gigi (Dental Cotton Pliers / Tweezers) — precision angled clinical forceps */
    case 'dental-pliers':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M9.5 38.5L29.5 19.5L38 16.8"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 38.5L24.8 15.2L35.5 11.5"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.8 31.2L19.6 26.8M18.2 28.6L21.5 24.8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle cx="10.2" cy="37.8" r="2" fill="currentColor" />
        </svg>
      );

    /* 4. Scaler Periodontal (Dental Scaler / Curette) — ergonomic handle with curved sickle scaling tip */
    case 'periodontal-scaler':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M15 33L31 17"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M31 17L35.5 12.5C37.6 10.4 39.8 8.8 41.2 10.2C42.2 11.2 40.6 14.4 38.5 16.2"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15 33L11.2 36.8C9.6 38.4 8.2 38.8 7.5 37.5C7 36.5 8 34.4 10 33.4"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.5 28.5L27.5 20.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="2 2.2"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      );

    /* 5. Handpiece Bor Gigi (Dental Turbine Handpiece) — angled clinical handpiece head & bur */
    case 'dental-handpiece':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M8.5 35.5L26.5 22.5L33.5 19.2"
            stroke="currentColor"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="32.2"
            y="14.2"
            width="6.4"
            height="7.4"
            rx="2"
            transform="rotate(-22 32.2 14.2)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M36.5 21.5L39.8 29.8"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <path
            d="M39.8 29.8L40.6 31.8"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M12.5 32.6L15.2 30.6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      );

    /* 6. Tang Pencabut Gigi (Dental Extraction Forceps) — hinged anatomical beaks & curved handles */
    case 'extraction-forceps':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M11 38.5C15.5 34.5 20.5 29.5 25.2 23.2C28.2 19.2 30.8 14.5 35.8 11.2"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M16.5 41C20.2 35.8 23.2 29.8 25.8 23.8C28.8 19.8 33.8 17.8 38.5 15.8"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <circle
            cx="25.5"
            cy="23.5"
            r="2.6"
            fill="var(--color-bg)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M35.8 11.2C37.8 10.5 39.2 11.8 38.5 13.5"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 7. Suntik Anestesi Lokal (Dental Carpule Syringe) — thumb-ring syringe silhouette */
    case 'carpule-syringe':
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <circle cx="10.5" cy="37.5" r="3.4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M13 35L18.5 29.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15.5 26.5L21.5 32.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <rect
            x="19.5"
            y="24.2"
            width="14.5"
            height="6.2"
            rx="1.6"
            transform="rotate(-45 19.5 24.2)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M24 24L27.8 20.2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M32 16L40.5 7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );

    /* 8. Gigi Molar Sehat (Anatomical Molar Silhouette) — dual-cusp crown & dual roots */
    case 'anatomical-molar':
    default:
      return (
        <svg viewBox="0 0 48 48" fill="none" className="h-9 w-9 sm:h-11 sm:w-11" aria-hidden="true">
          <path
            d="M16.2 10.5C12.2 10.5 9.5 14 10 18.8C10.5 23.6 12.6 26.8 13.6 31.8C14.3 35.4 15.2 38.8 17.5 38.8C19.6 38.8 20.4 34.4 22.1 31.2C22.8 29.8 25.2 29.8 25.9 31.2C27.6 34.4 28.4 38.8 30.5 38.8C32.8 38.8 33.7 35.4 34.4 31.8C35.4 26.8 37.5 23.6 38 18.8C38.5 14 35.8 10.5 31.8 10.5C29.1 10.5 26.7 12.1 24 12.1C21.3 12.1 18.9 10.5 16.2 10.5Z"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 16.8C20.6 18.2 22.4 18.6 24 18.6C25.6 18.6 27.4 18.2 29.5 16.8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      );
  }
}

/**
 * Home Hero Concentric Dental Instrument Orbit (`ConcentricDentalOrbit.tsx`, docs/DESIGN.md §3.1):
 * - 4 clean, thin circular concentric orbit rings centered behind the hero headline
 * - 8 custom frameless vector silhouettes of clinical dental instruments riding directly on the rings
 *   with ZERO boxes, ZERO rounded squares, ZERO borders, ZERO card backgrounds, and ZERO drop-shadows
 * - Alternating calm orbital rotation (55s, 70s, 85s, 100s) with inverse counter-rotation so each
 *   instrument stays upright; pauses automatically under `prefers-reduced-motion: reduce`.
 */
export function ConcentricDentalOrbit() {
  return (
    <div
      aria-hidden="true"
      data-testid="concentric-dental-orbit"
      className="pointer-events-none relative h-full w-full overflow-hidden select-none"
    >
      <div
        data-testid="dentist-3d-canvas"
        className="absolute inset-0 flex items-center justify-center"
      >
        {CONCENTRIC_ORBIT_RINGS.map((ring) => (
          <div
            key={ring.id}
            data-testid={ring.id}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: ring.diameterCss, height: ring.diameterCss }}
          >
            <div
              className={['relative h-full w-full rounded-full border', ring.ringAnimClass].join(
                ' ',
              )}
              style={{ borderColor: 'var(--color-orbit-ring)' }}
            >
              {ring.instruments.map((tool) => {
                const rad = (tool.angleDeg * Math.PI) / 180;
                const leftPct = +(50 + 50 * Math.cos(rad)).toFixed(4);
                const topPct = +(50 + 50 * Math.sin(rad)).toFixed(4);

                return (
                  <div
                    key={tool.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  >
                    <div
                      data-testid={`orbit-tool-${tool.id}`}
                      data-instrument={tool.label}
                      className={[
                        'inline-flex items-center justify-center',
                        ring.counterAnimClass,
                        tool.opacityClass,
                      ].join(' ')}
                      style={{
                        color:
                          tool.tone === 'accent'
                            ? 'var(--color-orbit-tool-accent)'
                            : 'var(--color-orbit-tool-primary)',
                      }}
                    >
                      {renderDentalInstrumentSvg(tool.id)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Clean central focal-zone fade so centered hero headline & CTA stay effortlessly legible */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, var(--color-bg) 0%, var(--color-bg) 22%, transparent 50%)',
          }}
        />
      </div>
    </div>
  );
}

export default ConcentricDentalOrbit;
