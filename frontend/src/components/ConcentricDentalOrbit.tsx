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
        id: 'dental-scan',
        label: 'AI Dental Scan',
        tooltip: 'AI Dental Scan • Pemindaian Gigi',
        href: '/scan',
        angleDeg: 0,
        tone: 'accent',
      },
      {
        id: 'mouth-mirror',
        label: 'Kaca Mulut',
        tooltip: 'Kaca Mulut • Pemeriksaan Visual',
        href: '/scan',
        angleDeg: 120,
        tone: 'primary',
      },
      {
        id: 'anatomical-molar',
        label: 'Gigi Molar Sehat',
        tooltip: 'Gigi Molar Sehat • Screening Preventif',
        href: '/scan',
        angleDeg: 240,
        tone: 'accent',
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
        label: 'Sonde Diagnostik',
        tooltip: 'Sonde Diagnostik • Deteksi Karies',
        href: '/scan',
        angleDeg: 35,
        tone: 'primary',
      },
      {
        id: 'periodontal-scaler',
        label: 'Scaler Periodontal',
        tooltip: 'Scaler Periodontal • Pembersih Karang Gigi',
        href: '/scan',
        angleDeg: 155,
        tone: 'accent',
      },
      {
        id: 'clinical-toothbrush',
        label: 'Sikat Gigi Klinis',
        tooltip: 'Sikat Gigi Klinis • Perawatan Harian',
        href: '/panduan',
        angleDeg: 275,
        tone: 'primary',
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
        id: 'dental-handpiece',
        label: 'Handpiece Turbin',
        tooltip: 'Handpiece Turbin • Perawatan Gigi',
        href: '/panduan',
        angleDeg: 65,
        tone: 'primary',
      },
      {
        id: 'dental-pliers',
        label: 'Pinset Klinis',
        tooltip: 'Pinset Klinis • Presisi Perawatan',
        href: '/panduan',
        angleDeg: 185,
        tone: 'accent',
      },
      {
        id: 'fluoride-paste',
        label: 'Pasta Fluoride',
        tooltip: 'Pasta Fluoride • Pelindung Email',
        href: '/panduan',
        angleDeg: 305,
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
        label: 'Tang Ekstraksi',
        tooltip: 'Tang Ekstraksi • Bedah Oral',
        href: '/panduan',
        angleDeg: 15,
        tone: 'primary',
      },
      {
        id: 'carpule-syringe',
        label: 'Spuit Anestesi',
        tooltip: 'Spuit Anestesi • Kontrol Nyeri',
        href: '/panduan',
        angleDeg: 135,
        tone: 'accent',
      },
      {
        id: 'dental-implant',
        label: 'Mahkota / Implan Gigi',
        tooltip: 'Mahkota & Implan Gigi • Restorasi',
        href: '/panduan',
        angleDeg: 255,
        tone: 'primary',
      },
    ],
  },
] as const;

interface StarDotSpec {
  left: string;
  top: string;
  size: number;
  kind: 'dot' | 'star';
  accent?: boolean;
  opacity: number;
}

const HERO_STARFIELD_DOTS: readonly StarDotSpec[] = [
  { left: '6%', top: '14%', size: 4, kind: 'dot', opacity: 0.24 },
  { left: '12%', top: '28%', size: 10, kind: 'star', accent: true, opacity: 0.32 },
  { left: '9%', top: '46%', size: 3, kind: 'dot', opacity: 0.22 },
  { left: '15%', top: '68%', size: 5, kind: 'dot', accent: true, opacity: 0.28 },
  { left: '7%', top: '82%', size: 11, kind: 'star', opacity: 0.26 },
  { left: '19%', top: '18%', size: 3, kind: 'dot', opacity: 0.22 },
  { left: '22%', top: '40%', size: 4, kind: 'dot', accent: true, opacity: 0.25 },
  { left: '24%', top: '76%', size: 3, kind: 'dot', opacity: 0.24 },
  { left: '28%', top: '11%', size: 9, kind: 'star', opacity: 0.28 },
  { left: '31%', top: '87%', size: 4, kind: 'dot', accent: true, opacity: 0.26 },
  { left: '36%', top: '20%', size: 3, kind: 'dot', opacity: 0.2 },
  { left: '41%', top: '9%', size: 4, kind: 'dot', accent: true, opacity: 0.28 },
  { left: '44%', top: '89%', size: 10, kind: 'star', opacity: 0.25 },
  { left: '53%', top: '12%', size: 3, kind: 'dot', opacity: 0.22 },
  { left: '58%', top: '86%', size: 4, kind: 'dot', accent: true, opacity: 0.28 },
  { left: '64%', top: '16%', size: 11, kind: 'star', accent: true, opacity: 0.3 },
  { left: '68%', top: '82%', size: 3, kind: 'dot', opacity: 0.22 },
  { left: '73%', top: '25%', size: 4, kind: 'dot', opacity: 0.26 },
  { left: '76%', top: '70%', size: 10, kind: 'star', opacity: 0.26 },
  { left: '79%', top: '13%', size: 3, kind: 'dot', accent: true, opacity: 0.26 },
  { left: '83%', top: '38%', size: 5, kind: 'dot', opacity: 0.22 },
  { left: '85%', top: '58%', size: 3, kind: 'dot', accent: true, opacity: 0.28 },
  { left: '88%', top: '22%', size: 12, kind: 'star', accent: true, opacity: 0.3 },
  { left: '91%', top: '44%', size: 4, kind: 'dot', opacity: 0.24 },
  { left: '93%', top: '74%', size: 4, kind: 'dot', accent: true, opacity: 0.28 },
  { left: '89%', top: '86%', size: 9, kind: 'star', opacity: 0.25 },
  { left: '4%', top: '60%', size: 4, kind: 'dot', accent: true, opacity: 0.24 },
  { left: '95%', top: '16%', size: 3, kind: 'dot', opacity: 0.24 },
  { left: '18%', top: '90%', size: 3, kind: 'dot', opacity: 0.2 },
  { left: '62%', top: '7%', size: 4, kind: 'dot', opacity: 0.22 },
  { left: '34%', top: '78%', size: 9, kind: 'star', accent: true, opacity: 0.26 },
  { left: '71%', top: '47%', size: 3, kind: 'dot', opacity: 0.2 },
] as const;

const INSTRUMENT_SVG_CLASS = 'h-12 w-12 sm:h-14 sm:w-14 lg:h-[60px] lg:w-[60px]';

function renderDentalInstrumentSvg(id: string) {
  switch (id) {
    /* 1. AI Dental Scan (Viewfinder frame + tooth scan beam) */
    case 'dental-scan':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M12 22V15C12 13.3 13.3 12 15 12H22M42 12H49C50.7 12 52 13.3 52 15V22M52 42V49C52 50.7 50.7 52 49 52H42M22 52H15C13.3 52 12 50.7 12 49V42"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M25.5 21C22.2 21 20 23.8 20.5 27.6C21 31.4 22.8 34 23.6 38.2C24.2 41 25 43.5 27 43.5C28.8 43.5 29.6 39.8 31 37.4C31.5 36.5 32.5 36.5 33 37.4C34.4 39.8 35.2 43.5 37 43.5C39 43.5 39.8 41 40.4 38.2C41.2 34 43 31.4 43.5 27.6C44 23.8 41.8 21 38.5 21C36.2 21 34.4 22.4 32 22.4C29.6 22.4 27.8 21 25.5 21Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          <path
            d="M16 32H48"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="3 2.5"
          />
        </svg>
      );

    /* 2. Kaca Mulut (Dental Mouth Mirror) */
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
            strokeWidth="1.95"
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
          <path d="M34.2 28.8L12.5 50.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M23.5 39.5L14 49" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <path d="M39.5 16.5C41.8 15.2 44.6 15.4 46.5 16.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    /* 3. Sonde Diagnostik (Dental Explorer / Probe) */
    case 'dental-explorer':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M21 43L42 22" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" />
          <path
            d="M42 22L48.5 15.5C51.4 12.6 55.6 13.6 56.2 17.4C56.7 20.4 54.1 23.2 51.2 23.5"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M21 43L13.5 50.5L9.2 48.2" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="51.2" cy="23.5" r="1.5" fill="currentColor" />
          <path d="M27.5 36.5L30 39M32.5 31.5L35 34M37.5 26.5L40 29" stroke="var(--color-bg)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    /* 4. Pinset Klinis (Dental Cotton Pliers / Tweezers) */
    case 'dental-pliers':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M12.5 51.5L39.5 26L52.5 21.5L35 19L12.5 51.5Z" fill="currentColor" fillOpacity="0.12" />
          <path d="M12.5 51.5L39.5 26L52.5 21.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12.5 51.5L33.5 19.5L49 14.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22.5 40.5L27 35.5M26 36.8L30.2 32" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
          <circle cx="13.2" cy="50.8" r="2.6" fill="currentColor" />
        </svg>
      );

    /* 5. Scaler Periodontal (Dental Scaler / Curette) */
    case 'periodontal-scaler':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M19.5 44.5L42.5 21.5" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" />
          <path
            d="M42.5 21.5L48.5 15.5C51.6 12.4 54.4 10.6 56 12.4C57.4 13.9 55.2 18.2 52 20.8L46.5 23.2"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M19.5 44.5L14 50C11.8 52.2 9.8 52.8 8.8 51C8.1 49.6 9.6 46.8 12.4 45.4"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M26 38L36 28" stroke="var(--color-bg)" strokeWidth="1.6" strokeDasharray="2.5 3" strokeLinecap="round" />
        </svg>
      );

    /* 6. Handpiece Turbin (Dental Turbine Handpiece) */
    case 'dental-handpiece':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M10.5 47.5L35 29.5L44.5 25" stroke="currentColor" strokeWidth="5.8" strokeLinecap="round" strokeLinejoin="round" />
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
            strokeWidth="1.95"
          />
          <path d="M49 28.4L53.4 40" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M53.4 40L54.6 43.2" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M16.5 43.2L23.5 38" stroke="var(--color-bg)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    /* 7. Tang Ekstraksi (Dental Extraction Forceps) */
    case 'extraction-forceps':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M14 51.5C20.5 46 27.5 39 33.8 30.8C37.8 25.4 41.2 19 48.2 14.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M21.5 55C26.8 47.8 31 39.8 34.6 31.8C38.6 26.4 45.2 23.6 52 20.8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="34.2" cy="31.2" r="3.8" fill="var(--color-bg)" stroke="currentColor" strokeWidth="2" />
          <circle cx="34.2" cy="31.2" r="1.4" fill="currentColor" />
          <path d="M48.2 14.5C51.2 13.4 53.2 15.2 52.2 17.8" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      );

    /* 8. Spuit Anestesi (Dental Carpule Syringe) */
    case 'carpule-syringe':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <circle cx="13.5" cy="50.5" r="4.8" stroke="currentColor" strokeWidth="2.1" />
          <path d="M17.2 46.8L24.5 39.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M20.5 35.5L28.5 43.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
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
            strokeWidth="1.95"
          />
          <path d="M32.5 31.5L38 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M43 21L54.8 9.2" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" />
        </svg>
      );

    /* 9. Sikat Gigi Klinis (Clinical Toothbrush) */
    case 'clinical-toothbrush':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path d="M12 52L42 22L48.5 15.5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M14 50L26 38" stroke="currentColor" strokeWidth="5.2" strokeLinecap="round" />
          <path
            d="M36 18L44 10L51 17L43 25L36 18Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.85"
            strokeLinejoin="round"
          />
          <path d="M39 15L42.5 18.5M42 12L45.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    /* 10. Pasta Fluoride (Fluoride Toothpaste Tube) */
    case 'fluoride-paste':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M15 41L35 17L48 28L25 50L15 41Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinejoin="round"
          />
          <path d="M12 44L22 53" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M41.5 22.5L47 16.5L51.5 20.5L46 26.5" stroke="currentColor" strokeWidth="1.95" strokeLinejoin="round" />
          <path d="M49.5 15.5C52.2 12.8 55 13 55.8 15.2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M27 36H35M31 32V40" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    /* 11. Mahkota / Implan Gigi (Dental Crown & Implant) */
    case 'dental-implant':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M22 12C17.5 12 14.8 15.6 15.5 20.5C16.2 25.2 18.6 28 21.5 29.5H42.5C45.4 28 47.8 25.2 48.5 20.5C49.2 15.6 46.5 12 42 12C38.6 12 35.8 13.8 32 13.8C28.2 13.8 25.4 12 22 12Z"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinejoin="round"
          />
          <rect x="26.5" y="29.5" width="11" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.85" />
          <path
            d="M27.5 34.5L29 52.5H35L36.5 34.5"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinejoin="round"
          />
          <path d="M27 39H37M27.5 43.5H36.5M28 48H36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    /* 12. Gigi Molar Sehat (Anatomical Molar Silhouette) */
    case 'anatomical-molar':
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" className={INSTRUMENT_SVG_CLASS} aria-hidden="true">
          <path
            d="M21.2 13.5C15.8 13.5 12 18.2 12.8 24.8C13.5 31.4 16.4 35.8 17.8 42.6C18.8 47.4 20 52 23.2 52C26 52 27.2 46 29.4 41.8C30.4 39.8 33.6 39.8 34.6 41.8C36.8 46 38 52 40.8 52C44 52 45.2 47.4 46.2 42.6C47.6 35.8 50.5 31.4 51.2 24.8C52 18.2 48.2 13.5 42.8 13.5C39 13.5 35.8 15.8 32 15.8C28.2 15.8 25 13.5 21.2 13.5Z"
            fill="currentColor"
            fillOpacity="0.14"
            stroke="currentColor"
            strokeWidth="1.95"
            strokeLinejoin="round"
          />
          <path d="M24.2 22.5C27.2 24.4 29.8 25 32 25C34.2 25 36.8 24.4 39.8 22.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
          <path d="M32 25V29.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        </svg>
      );
  }
}

/**
 * Home Hero Concentric Dental Instrument Orbit:
 * - 4 bold circular concentric orbit rings (`pointer-events-none`) over a crisp multi-sized geometric starfield
 * - 12 large (48px–60px), frameless interactive `<motion.button>` dental instruments (including AI Dental Scan)
 *   with ZERO boxes, ZERO borders, ZERO card backgrounds, and ZERO drop-shadow glows
 * - Hover scales to 1.25 with a floating clinical tooltip pill; click navigates to `/scan` or `/panduan`.
 */
export function ConcentricDentalOrbit() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      data-testid="concentric-dental-orbit"
      className="pointer-events-none relative h-full w-full overflow-hidden select-none"
    >
      {/* Rich multi-sized clinical starfield dots & geometric sparkles */}
      <div
        aria-hidden="true"
        data-testid="hero-starfield-dots"
        className="pointer-events-none absolute inset-0 z-0"
      >
        {HERO_STARFIELD_DOTS.map((star, idx) =>
          star.kind === 'star' ? (
            <svg
              key={`star-${idx}`}
              viewBox="0 0 16 16"
              width={star.size}
              height={star.size}
              fill="currentColor"
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: star.left,
                top: star.top,
                opacity: star.opacity,
                color: star.accent ? '#0E7490' : '#0B192C',
              }}
            >
              <path d="M8 0L9.7 6.3L16 8L9.7 9.7L8 16L6.3 9.7L0 8L6.3 6.3L8 0Z" />
            </svg>
          ) : (
            <span
              key={`dot-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: star.left,
                top: star.top,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                backgroundColor: star.accent ? '#0E7490' : '#0B192C',
              }}
            />
          ),
        )}
      </div>

      <div
        data-testid="dentist-3d-canvas"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        {/* Subtle central radial focal-zone fade so centered hero headline & CTA stay effortlessly legible */}
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
                'pointer-events-none relative h-full w-full rounded-full border-[1.75px]',
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
                        className="group pointer-events-auto relative inline-flex cursor-pointer items-center justify-center bg-transparent p-1 opacity-80 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
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
                          className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-pill border border-border bg-surface px-3 py-1 text-[11px] font-semibold tracking-tight text-text opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
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
