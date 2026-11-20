'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  BookOpen,
  Camera,
  Clock,
  Download,
  MapPin,
  MessageCircleHeart,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  UserCheck,
} from 'lucide-react';
import {
  DENTIST_WORLD_ARTICLES,
  DentalArticleModal,
  type DentalEducationArticle,
} from '../../components/DentalArticleModal';

const ARTICLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'scaling-rutin': Sparkles,
  'penambalan-karies': Stethoscope,
  'tanda-darurat-klinik': ShieldAlert,
  'persiapan-kunjungan': Clock,
};

const PANDUAN_RIBBON_ITEMS = [
  'Panduan Skrining Mandiri DentHub',
  'Foto Terang & Fokus',
  'Unduh Laporan Hasil AI',
  'Konsultasi Interaktif Deni',
  'Edukasi Dunia Dentist',
] as const;

const GUIDE_SECTIONS = [
  {
    step: '01',
    badge: 'Tahap 1 • Akun',
    title: 'Daftar & Masuk ke Akun DentHub',
    description:
      'Untuk menggunakan fitur AI Dental Scan dan mengelola Profil Anda, masuklah ke akun DentHub melalui menu Profil atau halaman Login. Halaman Beranda, Tanya Deni, Klinik, dan Panduan tetap dapat dibaca kapan saja.',
    icon: UserCheck,
  },
  {
    step: '02',
    badge: 'Tahap 2 • Pencahayaan',
    title: 'Tips Mengambil Foto Gigi yang Akurat',
    description:
      'Gunakan pencahayaan ruangan yang terang (atau lampu flash ponsel), bersihkan sisa makanan terlebih dahulu, buka mulut dengan jelas, dan pastikan kamera fokus pada area gigi atau gusi yang ingin diperiksa.',
    icon: Sun,
  },
  {
    step: '03',
    badge: 'Tahap 3 • AI Scan',
    title: 'Gunakan Fitur AI Scan & Riwayat di Sidebar',
    description:
      'Di halaman Scan, Anda dapat memotret lewat Kamera Langsung atau menyertakan file foto (JPG/PNG/WEBP ≤ 5 MB). Seluruh riwayat scan tersimpan rapi di Sidebar kiri dan dapat dibuka kembali kapan saja.',
    icon: Camera,
  },
  {
    step: '04',
    badge: 'Tahap 4 • Laporan',
    title: 'Unduh Hasil Laporan Screening',
    description:
      'Setelah analisis selesai, klik tombol "Unduh Hasil" untuk menyimpan kartu laporan lengkap (berisi kondisi terdeteksi, skor keyakinan AI, tingkat urgensi, serta daftar anjuran Do’s & Don’ts) ke perangkat Anda.',
    icon: Download,
  },
  {
    step: '05',
    badge: 'Tahap 5 • Deni AI',
    title: 'Konsultasi dengan Maskot AI Deni',
    description:
      'Klik maskot Deni yang mengambang di pojok kanan bawah layar ("Tanya Deni") atau menu Deni di Navbar untuk berkonsultasi mengenai hasil scan maupun keluhan gigi harian Anda.',
    icon: MessageCircleHeart,
  },
  {
    step: '06',
    badge: 'Tahap 6 • Klinik',
    title: 'Temukan Klinik Gigi Terdekat',
    description:
      'Buka menu Klinik untuk mencari lokasi praktik dokter gigi terdekat berbasis OpenStreetMap melalui GPS otomatis atau pencarian kota manual.',
    icon: MapPin,
  },
] as const;

/**
 * Halaman Panduan (`src/app/panduan/page.tsx`, docs/DESIGN.md §3.6):
 * - Section 1: Kinetic marquee + bold rounded stacked vertical step cards (`ekare-creative` style).
 * - Section 2: "Informasi Seputar Dunia Dentist & Perawatan Gigi" stacked clickable cards opening
 *   accessible full-article pop-up modals citing WHO, ADA, and Kemenkes RI.
 */
export default function PanduanPage() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedArticle, setSelectedArticle] = useState<DentalEducationArticle | null>(null);

  return (
    <main className="w-full bg-bg pb-24">
      {/* Kinetic Marquee Ribbon */}
      <div
        aria-hidden="true"
        data-testid="panduan-kinetic-ribbon"
        className="w-full overflow-hidden border-b border-border bg-brand-soft py-3"
      >
        <div className="animate-kinetic-marquee flex items-center gap-8 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-brand-dark sm:text-sm">
          {[...PANDUAN_RIBBON_ITEMS, ...PANDUAN_RIBBON_ITEMS].map((label, idx) => (
            <span key={`${label}-${idx}`} className="inline-flex items-center gap-4">
              <span>{label}</span>
              <span className="h-1.5 w-1.5 rounded-pill bg-brand-ring" />
            </span>
          ))}
        </div>
      </div>

      <div className="w-full space-y-16 px-4 py-12 sm:px-8 sm:py-16 lg:px-14">
        {/* =====================================================================
            SECTION 1: Panduan Penggunaan Aplikasi (Stacked Step Cards)
           ===================================================================== */}
        <section
          aria-labelledby="heading-panduan-aplikasi"
          data-testid="panduan-section-1-steps"
          className="w-full rounded-[2rem] border border-border bg-brand-soft/60 p-6 shadow-sm sm:p-10 lg:p-14"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-block rounded-pill border border-brand/20 bg-surface px-3.5 py-1 text-xs font-bold text-brand-dark">
              Pusat Bantuan • Panduan Pengguna DentHub
            </span>
            <h1
              id="heading-panduan-aplikasi"
              className="mt-3 text-2xl font-bold text-text sm:text-4xl"
            >
              Panduan Lengkap Penggunaan Aplikasi DentHub AI
            </h1>
            <p className="mt-2.5 text-sm text-text-muted sm:text-base">
              Pelajari cara melakukan screening kesehatan gigi mandiri, mengunduh laporan hasil,
              berkonsultasi dengan Deni, hingga menemukan klinik dokter gigi terdekat.
            </p>
          </motion.div>

          <div className="mx-auto mt-10 max-w-5xl space-y-5">
            {GUIDE_SECTIONS.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.step}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 32, scale: 0.97 }
                  }
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 130,
                          damping: 20,
                          delay: index * 0.05,
                        }
                  }
                  style={{ top: `${4.5 + index * 0.9}rem` }}
                  className="group sticky rounded-[1.5rem] border border-border bg-surface p-6 shadow-sm transition-all duration-200 hover:border-brand/50 hover:shadow-lg sm:p-8"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-44 sm:flex-col sm:items-start sm:justify-center">
                      <span className="font-display text-5xl font-extrabold leading-none tracking-tight text-brand transition-transform duration-200 group-hover:scale-105 sm:text-6xl">
                        {item.step}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{item.badge}</span>
                      </span>
                    </div>

                    <div className="hidden h-20 w-px bg-border sm:block" aria-hidden="true" />

                    <div className="flex-1 space-y-1.5">
                      <h2 className="text-xl font-bold text-text transition-colors group-hover:text-brand-dark sm:text-2xl">
                        {item.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-text-muted sm:text-base">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>

          <div className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-3 rounded-[1.5rem] border border-border bg-surface p-6 text-center shadow-sm">
            <Link
              href="/scan"
              className="inline-flex h-10 min-h-cta items-center justify-center whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-bold text-surface shadow-sm transition-colors hover:bg-brand-dark"
            >
              Mulai AI Scan Sekarang →
            </Link>
            <Link
              href="/chat"
              className="inline-flex h-10 min-h-touch items-center justify-center whitespace-nowrap rounded-xl bg-accent-deni px-5 text-sm font-bold text-surface shadow-sm transition-opacity hover:opacity-95"
            >
              Tanya Deni Sekarang
            </Link>
          </div>
        </section>

        {/* =====================================================================
            SECTION 2: Informasi Seputar Dunia Dentist & Perawatan Gigi
           ===================================================================== */}
        <section
          aria-labelledby="heading-dunia-dentist"
          data-testid="panduan-section-2-dentist-world"
          className="w-full rounded-[2rem] border border-border bg-surface p-6 shadow-sm sm:p-10 lg:p-14"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
            className="mx-auto max-w-3xl text-center"
          >
            <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
              Edukasi Kesehatan Gigi • Dunia Dentist
            </span>
            <h2
              id="heading-dunia-dentist"
              className="mt-3 text-2xl font-bold text-text sm:text-4xl"
            >
              Informasi Seputar Dunia Dentist &amp; Perawatan Gigi
            </h2>
            <p className="mt-2.5 text-sm text-text-muted sm:text-base">
              Klik salah satu topik di bawah ini untuk membaca artikel edukasi lengkap yang
              merujuk pada pedoman WHO, ADA, dan Kemenkes RI.
            </p>
          </motion.div>

          <div className="mx-auto mt-10 max-w-5xl space-y-5">
            {DENTIST_WORLD_ARTICLES.map((article, index) => {
              const Icon = ARTICLE_ICONS[article.id] ?? BookOpen;
              return (
                <motion.button
                  key={article.id}
                  type="button"
                  data-testid={`dentist-article-card-${article.id}`}
                  onClick={() => setSelectedArticle(article)}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, y: 32, scale: 0.97 }
                  }
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 135,
                          damping: 20,
                          delay: index * 0.06,
                        }
                  }
                  style={{ top: `${5 + index * 1.0}rem` }}
                  className="group sticky block w-full cursor-pointer rounded-[1.5rem] border border-border bg-bg p-6 text-left shadow-sm transition-all duration-200 hover:border-brand hover:bg-surface hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:p-8"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-48 sm:flex-col sm:items-start sm:justify-center">
                      <span className="font-display text-5xl font-extrabold leading-none tracking-tight text-brand transition-transform duration-200 group-hover:scale-105 sm:text-6xl">
                        {article.stepNumber}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{article.category}</span>
                      </span>
                    </div>

                    <div className="hidden h-24 w-px bg-border sm:block" aria-hidden="true" />

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-text-muted">
                        <span>{article.readTime}</span>
                        <span>•</span>
                        <span>Referensi WHO / ADA / Kemenkes RI</span>
                      </div>
                      <h3 className="text-xl font-bold text-text transition-colors group-hover:text-brand-dark sm:text-2xl">
                        {article.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-text-muted sm:text-base">
                        {article.summary}
                      </p>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Baca Artikel Lengkap</span>
                          <ArrowUpRight
                            className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>

      <DentalArticleModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />
    </main>
  );
}
