"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
} from "lucide-react";
import {
  DENTIST_WORLD_ARTICLES,
  DentalArticleModal,
  type DentalEducationArticle,
} from "../../components/DentalArticleModal";
import { KineticMarqueeRibbons } from "../../components/KineticMarqueeRibbons";

const ARTICLE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "scaling-rutin": Sparkles,
  "penambalan-karies": Stethoscope,
  "tanda-darurat-klinik": ShieldAlert,
  "persiapan-kunjungan": Clock,
};

const STACKED_CARD_THEMES = [
  {
    card: "bg-bg text-text border-white/15",
    num: "text-brand",
    badge: "bg-brand-soft text-brand-dark",
    meta: "text-text-muted",
    desc: "text-text-muted",
    cta: "text-brand-dark",
    divider: "bg-border",
  },
  {
    card: "bg-surface-mint text-text border-white/15",
    num: "text-brand-dark",
    badge: "bg-surface text-brand-dark",
    meta: "text-text-muted",
    desc: "text-text-muted",
    cta: "text-brand-dark",
    divider: "bg-brand/20",
  },
  {
    card: "bg-surface-teal text-white border-white/20",
    num: "text-white",
    badge: "bg-white/15 text-white",
    meta: "text-white/85",
    desc: "text-white/90",
    cta: "text-white",
    divider: "bg-white/25",
  },
  {
    card: "bg-surface-sand text-text border-white/15",
    num: "text-status-yellow",
    badge: "bg-surface text-text",
    meta: "text-text-muted",
    desc: "text-text-muted",
    cta: "text-text",
    divider: "bg-status-yellow/25",
  },
] as const;

const GUIDE_SECTIONS = [
  {
    step: "01",
    badge: "Tahap 1 • Akun",
    title: "Daftar & Masuk ke Akun Dentify",
    description:
      "Untuk menggunakan fitur AI Dental Scan dan mengelola Profil Anda, masuklah ke akun Dentify melalui menu Profil atau halaman Login. Halaman Beranda, Tanya Deni, Klinik, dan Panduan tetap dapat dibaca kapan saja.",
    icon: UserCheck,
  },
  {
    step: "02",
    badge: "Tahap 2 • Pencahayaan",
    title: "Tips Mengambil Foto Gigi yang Akurat",
    description:
      "Gunakan pencahayaan ruangan yang terang (atau lampu flash ponsel), bersihkan sisa makanan terlebih dahulu, buka mulut dengan jelas, dan pastikan kamera fokus pada area gigi atau gusi yang ingin diperiksa.",
    icon: Sun,
  },
  {
    step: "03",
    badge: "Tahap 3 • AI Scan",
    title: "Gunakan Fitur AI Scan & Riwayat di Sidebar",
    description:
      "Di halaman Scan, Anda dapat memotret lewat Kamera Langsung atau menyertakan file foto (JPG/PNG/WEBP ≤ 5 MB). Seluruh riwayat scan tersimpan rapi di Sidebar kiri dan dapat dibuka kembali kapan saja.",
    icon: Camera,
  },
  {
    step: "04",
    badge: "Tahap 4 • Laporan",
    title: "Unduh Hasil Laporan Screening",
    description:
      'Setelah analisis selesai, klik tombol "Unduh Hasil" untuk menyimpan kartu laporan lengkap (berisi kondisi terdeteksi, skor keyakinan AI, tingkat urgensi, serta daftar anjuran Do’s & Don’ts) ke perangkat Anda.',
    icon: Download,
  },
  {
    step: "05",
    badge: "Tahap 5 • Deni AI",
    title: "Konsultasi dengan Maskot AI Deni",
    description:
      'Klik maskot Deni yang mengambang di pojok kanan bawah layar ("Tanya Deni") atau menu Deni di Navbar untuk berkonsultasi mengenai hasil scan maupun keluhan gigi harian Anda.',
    icon: MessageCircleHeart,
  },
  {
    step: "06",
    badge: "Tahap 6 • Klinik",
    title: "Temukan Klinik Gigi Terdekat",
    description:
      "Buka menu Klinik untuk mencari lokasi praktik dokter gigi terdekat berbasis OpenStreetMap melalui GPS otomatis atau pencarian kota manual.",
    icon: MapPin,
  },
  {
    step: "07",
    anchorId: "panduan-hasil-kurang-meyakinkan",
    badge: "Tahap 7 • Tindak Lanjut",
    title: "Jika Hasil Scan Kurang Meyakinkan",
    description:
      "Jika skor keyakinan AI di bawah 75% atau kondisi tampak tumpang tindih: (1) ambil ulang foto close-up di bawah cahaya terang tanpa bayangan setelah membersihkan sisa makanan; (2) lampirkan foto gigi langsung ke Deni AI di halaman Chat (+ Tambah Foto atau Ctrl+V) agar Deni mengevaluasi foto bersama keluhan Anda; dan (3) segera kunjungi dokter gigi apabila muncul nyeri berdenyut, bengkak, perdarahan terus-menerus, atau keraguan yang menetap.",
    icon: ShieldAlert,
  },
] as const;

/**
 * Halaman Panduan:
 * - Double crossed bold kinetic marquee ribbons
 * - Section 1: Full-bleed dark-navy container with multi-tone stacked vertical guide cards (`01`–`06`)
 * - Section 2: Full-bleed dark-navy container with multi-tone stacked clickable
 *   "Informasi Seputar Dunia Dentist & Perawatan Gigi" cards opening cited pop-up article modals.
 */
export default function PanduanPage() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedArticle, setSelectedArticle] =
    useState<DentalEducationArticle | null>(null);

  return (
    <main className="w-full bg-surface-navy">
      <KineticMarqueeRibbons
        testId="panduan-kinetic-ribbon"
        topPhrases={[
          "PANDUAN SKRINING MANDIRI",
          "FOTO TERANG & FOKUS",
          "UNDUH LAPORAN HASIL AI",
          "KONSULTASI WITH DENI AI",
        ]}
        bottomPhrases={[
          "DUNIA DENTIST & PERAWATAN GIGI",
          "REFERENSI WHO • ADA • KEMENKES RI",
          "CEGAH KARIES SEJAK DINI",
          "KLINIK TERDEKAT",
          "CLINIC FINDER",
        ]}
      />

      <div className="w-full">
        {/* =====================================================================
            SECTION 1: Full-Bleed Edge-to-Edge Dark-Navy Multi-Tone Stacked Guide Steps
           ===================================================================== */}
        <section
          aria-labelledby="heading-panduan-aplikasi"
          data-testid="panduan-section-1-steps"
          className="w-full bg-surface-navy px-4 py-16 text-white sm:px-8 sm:py-24 lg:px-12"
        >
          <div className="mx-auto w-full max-w-[1380px]">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
              className="mx-auto max-w-3xl text-center"
            >
              <span className="inline-block rounded-pill border border-white/20 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-zinc-200">
                Pusat Bantuan • Panduan Pengguna Dentify
              </span>
              <h1
                id="heading-panduan-aplikasi"
                className="mt-3 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl"
              >
                Panduan Lengkap Penggunaan Aplikasi Dentify AI
              </h1>
              <p className="mt-3 text-sm text-slate-200 sm:text-base">
                Pelajari cara melakukan screening kesehatan gigi mandiri,
                mengunduh laporan hasil, berkonsultasi dengan Deni, hingga
                menemukan klinik dokter gigi terdekat.
              </p>
            </motion.div>

            <div className="mx-auto mt-14 w-full max-w-[1380px] space-y-8">
              {GUIDE_SECTIONS.map((item, index) => {
                const Icon = item.icon;
                const theme =
                  STACKED_CARD_THEMES[index % STACKED_CARD_THEMES.length];
                const anchorId = "anchorId" in item ? item.anchorId : undefined;
                return (
                  <motion.article
                    key={item.step}
                    id={anchorId}
                    data-testid={
                      anchorId === "panduan-hasil-kurang-meyakinkan"
                        ? "panduan-low-confidence-guide"
                        : undefined
                    }
                    initial={
                      prefersReducedMotion
                        ? false
                        : { opacity: 0, y: 32, scale: 0.97 }
                    }
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 130,
                            damping: 20,
                            delay: index * 0.05,
                          }
                    }
                    style={{ top: `${4.5 + index * 1.25}rem` }}
                    className={[
                      "group sticky flex min-h-[250px] items-center rounded-[2rem] border p-7 shadow-xl transition-all duration-200 hover:shadow-2xl sm:min-h-[290px] sm:p-11",
                      theme.card,
                    ].join(" ")}
                  >
                    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center">
                        <span
                          className={[
                            "font-display text-6xl font-extrabold leading-none tracking-tight transition-transform duration-200 group-hover:scale-105 sm:text-7xl",
                            theme.num,
                          ].join(" ")}
                        >
                          {item.step}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-bold",
                            theme.badge,
                          ].join(" ")}
                        >
                          <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{item.badge}</span>
                        </span>
                      </div>

                      <div
                        className={[
                          "hidden h-28 w-px sm:block",
                          theme.divider,
                        ].join(" ")}
                        aria-hidden="true"
                      />

                      <div className="flex-1 space-y-2.5">
                        <h2 className="text-2xl font-extrabold sm:text-3xl">
                          {item.title}
                        </h2>
                        <p
                          className={[
                            "text-base leading-relaxed sm:text-lg",
                            theme.desc,
                          ].join(" ")}
                        >
                          {item.description}
                        </p>
                        {anchorId === "panduan-hasil-kurang-meyakinkan" && (
                          <div className="flex flex-wrap items-center gap-2.5 pt-2">
                            <Link
                              href="/chat"
                              className="inline-flex h-9 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand px-4 text-xs font-bold text-[var(--color-on-brand)] shadow-sm transition-colors hover:bg-[var(--color-brand-hover)]"
                            >
                              <MessageCircleHeart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Konsultasi Foto ke Deni AI →</span>
                            </Link>
                            <Link
                              href="/scan"
                              className="inline-flex h-9 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/25 bg-white/15 px-4 text-xs font-bold text-white transition-colors hover:bg-white/25"
                            >
                              <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Ambil Ulang Foto di AI Scan</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>

            <div className="mx-auto mt-14 flex w-full max-w-[1380px] flex-wrap items-center justify-center gap-3 rounded-[1.5rem] border border-white/15 bg-white/10 p-6 text-center">
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
          </div>
        </section>

        {/* =====================================================================
            SECTION 2: Full-Bleed Edge-to-Edge Dark-Navy Multi-Tone Clickable Dental Articles
           ===================================================================== */}
        <section
          aria-labelledby="heading-dunia-dentist"
          data-testid="panduan-section-2-dentist-world"
          className="w-full border-t border-white/15 bg-surface-navy px-4 py-16 text-white sm:px-8 sm:py-24 lg:px-12"
        >
          <div className="mx-auto w-full max-w-[1380px]">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
              className="mx-auto max-w-3xl text-center"
            >
              <span className="inline-block rounded-pill border border-white/20 bg-white/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-zinc-200">
                Edukasi Kesehatan Gigi • Dunia Dentist
              </span>
              <h2
                id="heading-dunia-dentist"
                className="mt-3 text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl"
              >
                Informasi Seputar Dunia Dentist &amp; Perawatan Gigi
              </h2>
              <p className="mt-3 text-sm text-slate-200 sm:text-base">
                Klik salah satu kartu topik di bawah ini untuk membaca artikel
                edukasi lengkap yang merujuk pada pedoman WHO, ADA, dan Kemenkes
                RI.
              </p>
            </motion.div>

            <div className="mx-auto mt-14 w-full max-w-[1380px] space-y-8">
              {DENTIST_WORLD_ARTICLES.map((article, index) => {
                const Icon = ARTICLE_ICONS[article.id] ?? BookOpen;
                const theme =
                  STACKED_CARD_THEMES[index % STACKED_CARD_THEMES.length];
                return (
                  <motion.button
                    key={article.id}
                    type="button"
                    data-testid={`dentist-article-card-${article.id}`}
                    onClick={() => setSelectedArticle(article)}
                    initial={
                      prefersReducedMotion
                        ? false
                        : { opacity: 0, y: 32, scale: 0.97 }
                    }
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 135,
                            damping: 20,
                            delay: index * 0.06,
                          }
                    }
                    style={{ top: `${4.5 + index * 1.25}rem` }}
                    className={[
                      "group sticky flex min-h-[250px] w-full cursor-pointer items-center rounded-[2rem] border p-7 text-left shadow-xl transition-all duration-200 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:min-h-[290px] sm:p-11",
                      theme.card,
                    ].join(" ")}
                  >
                    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center">
                        <span
                          className={[
                            "font-display text-6xl font-extrabold leading-none tracking-tight transition-transform duration-200 group-hover:scale-105 sm:text-7xl",
                            theme.num,
                          ].join(" ")}
                        >
                          {article.stepNumber}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-bold",
                            theme.badge,
                          ].join(" ")}
                        >
                          <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{article.category}</span>
                        </span>
                      </div>

                      <div
                        className={[
                          "hidden h-28 w-px sm:block",
                          theme.divider,
                        ].join(" ")}
                        aria-hidden="true"
                      />

                      <div className="flex-1 space-y-2.5">
                        <div
                          className={[
                            "flex flex-wrap items-center gap-2 text-xs font-semibold",
                            theme.meta,
                          ].join(" ")}
                        >
                          <span>{article.readTime}</span>
                          <span>•</span>
                          <span>Referensi WHO / ADA / Kemenkes RI</span>
                        </div>
                        <h3 className="text-2xl font-extrabold sm:text-3xl">
                          {article.title}
                        </h3>
                        <p
                          className={[
                            "text-base leading-relaxed sm:text-lg",
                            theme.desc,
                          ].join(" ")}
                        >
                          {article.summary}
                        </p>
                        <div className="pt-1">
                          <span
                            className={[
                              "inline-flex items-center gap-1.5 text-xs font-bold",
                              theme.cta,
                            ].join(" ")}
                          >
                            <BookOpen
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
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
          </div>
        </section>

        {/* =====================================================================
            SECTION 3: Duplicate Crossed Kinetic Marquee (Swapped) & Smooth DENTIFY. Wordmark
           ===================================================================== */}
        <section
          aria-label="Penutup Interaktif Dentify"
          data-testid="panduan-bottom-wordmark"
          className="w-full overflow-hidden border-t border-white/15 bg-surface-navy pb-16 pt-6 text-white md:pb-20"
        >
          {/* Duplicate Double-Crossed Kinetic Marquee Ribbons with Top & Bottom Phrases Swapped */}
          <KineticMarqueeRibbons
            testId="panduan-bottom-kinetic-ribbon"
            topPhrases={[
              'DUNIA DENTIST & PERAWATAN GIGI',
              'REFERENSI WHO • ADA • KEMENKES RI',
              'CEGAH KARIES SEJAK DINI',
              'KLINIK TERDEKAT',
              'CLINIC FINDER',
            ]}
            bottomPhrases={[
              'PANDUAN SKRINING MANDIRI',
              'FOTO TERANG & FOKUS',
              'UNDUH LAPORAN HASIL AI',
              'KONSULTASI WITH DENI AI',
            ]}
          />

          {/* Oversized Full-Width Interactive DENTIFY. Display Wordmark */}
          <div className="mx-auto flex w-full max-w-[1380px] flex-col items-center justify-center px-4 pt-12 text-center sm:px-8 sm:pt-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              Kesehatan Gigi Preventif Untuk Semua
            </p>
            <div
              aria-label="DENTIFY."
              className="flex select-none flex-wrap items-baseline justify-center font-display text-[4.5rem] font-black leading-none tracking-tighter sm:text-[8rem] lg:text-[11rem]"
            >
              {Array.from('DENTIFY').map((char, idx) => (
                <motion.span
                  key={`${char}-${idx}`}
                  initial="rest"
                  animate="rest"
                  whileHover={prefersReducedMotion ? undefined : 'hover'}
                  variants={{
                    rest: {
                      y: 0,
                      scale: 1,
                      rotate: 0,
                      color: '#FFFFFF',
                      transition: {
                        y: { type: 'spring', stiffness: 110, damping: 18 },
                        scale: { type: 'spring', stiffness: 110, damping: 18 },
                        rotate: { type: 'spring', stiffness: 110, damping: 18 },
                        color: { duration: 0.35, ease: 'easeOut' },
                      },
                    },
                    hover: {
                      y: -14,
                      scale: 1.09,
                      rotate: idx % 2 === 0 ? -4 : 4,
                      color: '#9FE7F5',
                      transition: {
                        y: { type: 'spring', stiffness: 110, damping: 18 },
                        scale: { type: 'spring', stiffness: 110, damping: 18 },
                        rotate: { type: 'spring', stiffness: 110, damping: 18 },
                        color: { delay: 0.45, duration: 0.4, ease: 'easeOut' },
                      },
                    },
                  }}
                  className="inline-block cursor-default text-white"
                >
                  {char}
                </motion.span>
              ))}
              <motion.span
                initial="rest"
                animate="rest"
                whileHover={prefersReducedMotion ? undefined : 'hover'}
                variants={{
                  rest: {
                    y: 0,
                    scale: 1,
                    rotate: 0,
                    color: '#0284C7',
                    transition: {
                      y: { type: 'spring', stiffness: 110, damping: 18 },
                      scale: { type: 'spring', stiffness: 110, damping: 18 },
                      rotate: { type: 'spring', stiffness: 110, damping: 18 },
                      color: { duration: 0.35, ease: 'easeOut' },
                    },
                  },
                  hover: {
                    y: -16,
                    scale: 1.25,
                    rotate: 12,
                    color: '#9FE7F5',
                    transition: {
                      y: { type: 'spring', stiffness: 110, damping: 18 },
                      scale: { type: 'spring', stiffness: 110, damping: 18 },
                      rotate: { type: 'spring', stiffness: 110, damping: 18 },
                      color: { delay: 0.45, duration: 0.4, ease: 'easeOut' },
                    },
                  },
                }}
                className="inline-block cursor-default text-brand-ring"
              >
                .
              </motion.span>
            </div>
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
