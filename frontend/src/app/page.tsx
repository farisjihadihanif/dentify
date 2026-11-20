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
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { DentistWorld3DCanvas } from '../components/DentistWorld3DCanvas';

const TIMELINE_FLOW_STEPS = [
  {
    step: '01',
    title: '01 Unggah Foto / Kamera Langsung',
    subtitle: 'Ambil Foto Gigi dengan Panduan Pencahayaan',
    description:
      'Masuk ke akun DentHub Anda lalu ambil foto area gigi menggunakan kamera langsung atau sertakan file foto dari perangkat.',
    icon: Camera,
  },
  {
    step: '02',
    title: '02 AI Menganalisis Kondisi Gigi',
    subtitle: 'Preprocessing OpenCV CLAHE & Deep Learning (.keras)',
    description:
      'Model Computer Vision menganalisis indikasi karies, karang gigi, atau radang gusi beserta tingkat keyakinan dan urgensi medis.',
    icon: Sparkles,
  },
  {
    step: '03',
    title: '03 Dapatkan Hasil & Unduh Laporan',
    subtitle: "Rekomendasi Perawatan Do's & Don'ts Terstruktur",
    description:
      'Terima laporan lengkap yang dapat diunduh langsung ke perangkat Anda, disertai daftar hal yang dianjurkan dan yang harus dihindari.',
    icon: FileCheck2,
  },
  {
    step: '04',
    title: '04 Konsultasi Deni & Klinik Terdekat',
    subtitle: 'Asisten AI Deni & Peta OpenStreetMap',
    description:
      'Tanyakan tindak lanjut ke asisten AI Deni atau temukan lokasi klinik dokter gigi terdekat secara otomatis saat kondisi darurat.',
    icon: MapPin,
  },
] as const;

/**
 * Home Page DentHub (`src/app/page.tsx`, docs/DESIGN.md §3.1) — 3 Sections:
 * 1. Section 1: Interactive 3D Dental Screening Hero (scanning beam, drag-to-rotate, clickable hotspots).
 * 2. Section 2: Full-bleed edge-to-edge (`w-full`) animated application flow timeline.
 * 3. Section 3: AI Scan & Tanya Deni feature preview cards.
 */
export default function HomePage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="bg-bg text-text">
      {/* =====================================================================
          SECTION 1: Full-Screen Hero dengan Animasi 3D Pemeriksaan Gigi Interaktif
         ===================================================================== */}
      <section
        aria-label="Hero Dunia Dentist 3D"
        data-testid="home-section-1-hero"
        className="bg-dental-grid relative flex min-h-screen items-center overflow-hidden bg-gradient-to-b from-brand-soft/60 via-bg to-bg py-12 sm:py-16"
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="relative z-10 space-y-5 text-center lg:col-span-6 lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-pill border border-brand/25 bg-surface px-3.5 py-1 text-xs font-bold text-brand-dark shadow-sm">
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand" />
              <span>AI Dental Screening • Pemeriksaan 3D Interaktif</span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-5xl">
              Cegah Gigi Berlubang Sejak Dini
            </h1>

            <p className="mx-auto max-w-xl text-base leading-relaxed text-text-muted sm:text-lg lg:mx-0">
              Dapatkan pemeriksaan gigi online gratis dan temukan solusi untuk masalah gigi Anda!
            </p>

            <div className="pt-2">
              <Link
                href="/scan"
                data-testid="hero-cta-cek-sekarang"
                className="inline-flex h-11 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-brand px-6 text-base font-bold text-surface shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-brand-dark"
              >
                <span>Cek Sekarang!</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </div>

          <div className="relative h-[430px] w-full sm:h-[490px] lg:col-span-6 lg:h-[540px]">
            <DentistWorld3DCanvas />
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: Full-Bleed Edge-to-Edge Alur Aplikasi dengan Animasi Scroll & Hover
         ===================================================================== */}
      <section
        id="alur-aplikasi"
        aria-labelledby="heading-alur-aplikasi"
        data-testid="home-section-2-flow"
        className="w-full border-y border-border bg-surface py-16 sm:py-20"
      >
        <div className="w-full px-4 sm:px-8 lg:px-14 xl:px-20">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            className="text-center"
          >
            <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
              Alur Penggunaan Aplikasi
            </span>
            <h2
              id="heading-alur-aplikasi"
              className="mt-2.5 text-2xl font-bold text-text sm:text-3xl"
            >
              Cara Kerja DentHub dari Awal hingga Solusi
            </h2>
            <p className="mx-auto mt-2 max-w-3xl text-sm text-text-muted sm:text-base">
              Ikuti 4 langkah berurutan di bawah ini untuk memeriksa kondisi gigi Anda secara mandiri
              dan terarah.
            </p>
          </motion.div>

          <div className="relative mt-12 w-full space-y-6 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-0.5 before:rounded-pill before:bg-brand/30 sm:before:left-6">
            {TIMELINE_FLOW_STEPS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.step}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.4,
                    delay: prefersReducedMotion ? 0 : index * 0.08,
                  }}
                  className="group relative flex w-full items-start gap-4 pl-1 sm:gap-6 sm:pl-2"
                >
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-surface shadow-sm ring-4 ring-surface transition-transform duration-200 group-hover:scale-110 sm:h-11 sm:w-11">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  <div className="flex-1 rounded-card border border-border bg-bg p-5 shadow-sm transition-all duration-200 group-hover:border-brand/50 group-hover:bg-surface group-hover:shadow-md sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-pill bg-brand-soft px-3 py-0.5 text-xs font-bold text-brand-dark">
                        Langkah {item.step}
                      </span>
                      <span className="text-xs font-medium text-text-muted">{item.subtitle}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-text sm:text-xl">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted sm:text-base">
                      {item.description}
                    </p>
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
        className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-6 lg:px-8"
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
          {/* Kartu Preview 1: Fitur AI Scan Gigi */}
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

          {/* Kartu Preview 2: Tanyakan ke Deni */}
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
