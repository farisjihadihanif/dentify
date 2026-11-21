'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Camera,
  Sparkles,
  FileCheck2,
  MessageCircleHeart,
  MapPin,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DentHubLogo } from '../components/DentHubLogo';
import { ConcentricDentalOrbit } from '../components/ConcentricDentalOrbit';
import { KineticMarqueeRibbons } from '../components/KineticMarqueeRibbons';

const STACKED_CARD_THEMES = [
  {
    card: 'bg-bg text-text border-white/15',
    num: 'text-brand',
    badge: 'bg-brand-soft text-brand-dark',
    subtitle: 'text-text-muted',
    desc: 'text-text-muted',
    divider: 'bg-border',
  },
  {
    card: 'bg-surface-mint text-text border-white/15',
    num: 'text-brand-dark',
    badge: 'bg-surface text-brand-dark',
    subtitle: 'text-text-muted',
    desc: 'text-text-muted',
    divider: 'bg-brand/20',
  },
  {
    card: 'bg-surface-teal text-white border-white/20',
    num: 'text-white',
    badge: 'bg-white/15 text-white',
    subtitle: 'text-white/85',
    desc: 'text-white/90',
    divider: 'bg-white/25',
  },
  {
    card: 'bg-surface-sand text-text border-white/15',
    num: 'text-status-yellow',
    badge: 'bg-surface text-text',
    subtitle: 'text-text-muted',
    desc: 'text-text-muted',
    divider: 'bg-status-yellow/25',
  },
] as const;

const TIMELINE_FLOW_STEPS = [
  {
    step: '01',
    badge: 'Tahap 1 • Foto',
    title: '01 Unggah Foto / Kamera Langsung',
    subtitle: 'Ambil Foto Gigi dengan Panduan Pencahayaan',
    description:
      'Masuk ke akun DentHub Anda lalu ambil foto area gigi menggunakan kamera langsung atau sertakan file foto dari perangkat.',
    icon: Camera,
  },
  {
    step: '02',
    badge: 'Tahap 2 • Analisis AI',
    title: '02 AI Menganalisis Kondisi Gigi',
    subtitle: 'Preprocessing OpenCV CLAHE & Deep Learning (.keras)',
    description:
      'Model Computer Vision menganalisis indikasi karies, karang gigi, atau radang gusi beserta tingkat keyakinan dan urgensi medis.',
    icon: Sparkles,
  },
  {
    step: '03',
    badge: 'Tahap 3 • Laporan',
    title: '03 Dapatkan Hasil & Unduh Laporan',
    subtitle: "Rekomendasi Perawatan Do's & Don'ts Terstruktur",
    description:
      'Terima laporan lengkap yang dapat diunduh langsung ke perangkat Anda, disertai daftar hal yang dianjurkan dan yang harus dihindari.',
    icon: FileCheck2,
  },
  {
    step: '04',
    badge: 'Tahap 4 • Tindak Lanjut',
    title: '04 Konsultasi Deni & Klinik Terdekat',
    subtitle: 'Asisten AI Deni & Peta OpenStreetMap',
    description:
      'Tanyakan tindak lanjut ke asisten AI Deni atau temukan lokasi klinik dokter gigi terdekat secara otomatis saat kondisi darurat.',
    icon: MapPin,
  },
] as const;

/**
 * Home Page DentHub (`src/app/page.tsx`, docs/DESIGN.md §3.1) — 3 Sections:
 * 1. Section 1: Top-left DentHub logo + centered Hero copy surrounded by orbiting 3D dental icon badges.
 * 2. Double Crossed Bold Kinetic Marquee Ribbons + Full-Bleed Dark-Navy Multi-Tone Stacked Step Cards.
 * 3. Section 3: AI Scan & Tanya Deni feature preview cards.
 */
export default function HomePage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="bg-bg text-text">
      {/* =====================================================================
          SECTION 1: Centered Hero Copy + Concentric Frameless Dental Instrument Orbit + Top-Left Logo
         ===================================================================== */}
      <section
        aria-label="Hero Dunia Dentist"
        data-testid="home-section-1-hero"
        className="bg-dental-grid relative flex min-h-[calc(100svh-4rem)] w-full items-center justify-center overflow-hidden bg-bg"
      >
        {/* Top-Left Official DentHub Logo + Wordmark */}
        <Link
          href="/"
          aria-label="DentHub Beranda"
          data-testid="hero-top-left-logo"
          className="absolute left-5 top-5 z-20 inline-flex items-center rounded-pill bg-surface/90 px-3 py-1.5 shadow-sm ring-1 ring-border transition-colors hover:bg-surface sm:left-8 sm:top-7"
        >
          <DentHubLogo size={30} showText />
        </Link>

        {/* Full-Section Interactive Concentric Dental Instrument Orbit */}
        <div className="absolute inset-0 h-full w-full z-10 pointer-events-none">
          <ConcentricDentalOrbit />
        </div>

        {/* Centered Hero Typography Floating Directly Over Concentric Orbit */}
        <div className="pointer-events-none relative z-20 mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-5xl lg:text-6xl">
            Cegah Gigi Berlubang Sejak Dini
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-text-muted sm:text-lg">
            Dapatkan pemeriksaan gigi online gratis dan temukan solusi untuk masalah gigi Anda!
          </p>

          <div className="mt-7">
            <Link
              href="/scan"
              data-testid="hero-cta-cek-sekarang"
              className="pointer-events-auto inline-flex h-11 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-brand px-7 text-base font-bold text-surface shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-dark dark:bg-[#F4F4F5] dark:text-[#09090B] dark:hover:bg-white"
            >
              <span>Cek Sekarang!</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================================
          DOUBLE CROSSED BOLD KINETIC MARQUEE RIBBONS (ekare-creative Style)
         ===================================================================== */}
      <KineticMarqueeRibbons testId="home-kinetic-ribbon" />

      {/* =====================================================================
          SECTION 2: Full-Bleed Edge-to-Edge Dark-Navy Multi-Tone Stacked Step Cards
         ===================================================================== */}
      <section
        id="alur-aplikasi"
        aria-labelledby="heading-alur-aplikasi"
        data-testid="home-section-2-flow"
        className="w-full bg-surface-navy px-4 py-16 text-white sm:px-8 sm:py-24 lg:px-12"
      >
        <div className="mx-auto w-full max-w-[1380px]">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h2
              id="heading-alur-aplikasi"
              className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl"
            >
              Cara Kerja DentHub dari Awal hingga Solusi
            </h2>
          </motion.div>

          {/* Alternating High-Contrast Multi-Tone Stacked Cards */}
          <div className="mx-auto mt-14 w-full max-w-[1380px] space-y-8">
            {TIMELINE_FLOW_STEPS.map((item, index) => {
              const Icon = item.icon;
              const theme = STACKED_CARD_THEMES[index % STACKED_CARD_THEMES.length];
              return (
                <motion.article
                  key={item.step}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 36, scale: 0.97 }
                  }
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 125,
                          damping: 20,
                          delay: index * 0.06,
                        }
                  }
                  style={{ top: `${4.5 + index * 1.25}rem` }}
                  className={[
                    'group sticky flex min-h-[250px] items-center rounded-[2rem] border p-7 shadow-xl transition-all duration-200 hover:shadow-2xl sm:min-h-[290px] sm:p-11',
                    theme.card,
                  ].join(' ')}
                >
                  <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center">
                      <span
                        className={[
                          'font-display text-6xl font-extrabold leading-none tracking-tight transition-transform duration-200 group-hover:scale-105 sm:text-7xl',
                          theme.num,
                        ].join(' ')}
                      >
                        {item.step}
                      </span>
                      <span
                        className={[
                          'inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-bold',
                          theme.badge,
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{item.badge}</span>
                      </span>
                    </div>

                    <div
                      className={['hidden h-28 w-px sm:block', theme.divider].join(' ')}
                      aria-hidden="true"
                    />

                    <div className="flex-1 space-y-2.5">
                      <p
                        className={[
                          'text-xs font-bold uppercase tracking-wider',
                          theme.subtitle,
                        ].join(' ')}
                      >
                        {item.subtitle}
                      </p>
                      <h3 className="text-2xl font-extrabold sm:text-3xl">{item.title}</h3>
                      <p className={['text-base leading-relaxed sm:text-lg', theme.desc].join(' ')}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: Preview Fitur Scan & Tanyakan ke Deni
         ===================================================================== */}
      <section
        aria-labelledby="heading-preview-fitur"
        data-testid="home-section-3-preview"
        className="mx-auto max-w-6xl space-y-10 px-4 pb-24 pt-16 sm:px-6 lg:px-8"
      >
        <div className="text-center">
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            Fitur Unggulan DentHub
          </span>
          <h2 id="heading-preview-fitur" className="mt-2.5 text-2xl font-bold text-text sm:text-3xl">
            Preview Fitur AI Scan &amp; Tanyakan ke Deni
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-text-muted sm:text-base">
            Kombinasi Computer Vision untuk deteksi visual dan asisten AI Deni untuk konsultasi
            perawatan gigi harian Anda.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-between rounded-card border border-border bg-surface p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
                  <Camera className="h-3.5 w-3.5" />
                  <span>Fitur Utama • AI Dental Scan</span>
                </span>
                <span className="text-xs font-semibold text-status-green">
                  Kamera &amp; Unggah File
                </span>
              </div>

              <h3 className="text-xl font-bold text-text">
                Deteksi Dini Karies, Karang Gigi, &amp; Kondisi Gusi
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                Ambil foto gigi dengan panduan pencahayaan interaktif. Sistem memproses gambar
                dengan OpenCV CLAHE dan model Deep Learning untuk menghasilkan laporan yang dapat
                langsung Anda unduh.
              </p>

              <div className="rounded-card border border-border bg-bg p-4">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div>
                    <p className="text-xs font-bold text-text">
                      Ilustrasi Hasil: Indikasi Karies Gigi
                    </p>
                    <p className="text-xs text-text-muted">
                      Hasil analisis AI • Indikasi visual terdeteksi • Dapat Diunduh
                    </p>
                  </div>
                  <span className="rounded-pill bg-status-red px-2.5 py-0.5 text-xs font-semibold text-surface">
                    Segera Periksa
                  </span>
                </div>
                <p className="mt-2.5 flex items-start gap-1.5 text-xs text-text-muted">
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-green"
                    aria-hidden="true"
                  />
                  <span>
                    Dilengkapi daftar anjuran (Do&apos;s), pantangan (Don&apos;ts), tombol Unduh
                    Hasil, dan riwayat scan di sidebar.
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/scan"
                className="inline-flex h-10 min-h-cta w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-brand-dark"
              >
                <span>Buka Fitur AI Scan Sekarang</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-card border border-border bg-surface p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-deni-soft px-3 py-1 text-xs font-bold text-accent-deni">
                  <MessageCircleHeart className="h-3.5 w-3.5" />
                  <span>Asisten AI • Tanyakan ke Deni</span>
                </span>
                <span className="text-xs font-semibold text-brand-dark">Online 24/7</span>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src="/images/deni-mascot.png"
                  alt="Maskot Deni"
                  className="h-16 w-16 shrink-0 object-contain drop-shadow-sm"
                />
                <div>
                  <h3 className="text-xl font-bold text-text">
                    Konsultasi Interaktif Bersama Deni
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Tanyakan arti hasil scan Anda, langkah pertolongan pertama saat gigi ngilu, atau
                    rekomendasi klinik gigi terdekat kepada Deni.
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-card border border-border bg-bg p-3.5 text-xs">
                <div className="ml-auto max-w-xs rounded-xl bg-brand px-3 py-2 text-surface">
                  &ldquo;Deni, gigi geraham saya ngilu saat minum air dingin, harus bagaimana?&rdquo;
                </div>
                <div className="max-w-md rounded-xl border border-accent-deni/20 bg-accent-deni-soft px-3 py-2 text-text">
                  <span className="mb-1 flex items-center gap-1.5">
                    <strong className="text-accent-deni">Deni</strong>
                    <span className="rounded-pill bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent-deni">
                      Dibuat oleh AI
                    </span>
                  </span>
                  &ldquo;Hindari minuman terlalu dingin atau manis sementara waktu, gunakan pasta
                  gigi khusus gigi sensitif berfluoride, dan jadwalkan pemeriksaan ke dokter gigi
                  terdekat.&rdquo;
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/chat"
                className="inline-flex h-10 min-h-cta w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-deni px-4 text-sm font-semibold text-surface shadow-sm transition-opacity hover:opacity-95"
              >
                <MessageCircleHeart className="h-4 w-4 shrink-0" />
                <span>Tanyakan ke Deni Sekarang</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
