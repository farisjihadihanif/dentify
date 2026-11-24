"use client";

import React, { useState } from "react";
import Link from "next/link";
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
      "Di halaman Scan, Anda dapat memotret lewat Kamera Langsung atau menyertakan file foto (JPG/PNG/WEBP, foto besar dikompres otomatis). Seluruh riwayat scan tersimpan rapi di Sidebar kiri dan dapat dibuka kembali kapan saja.",
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
      "Jika skor keyakinan AI di bawah 60% atau kondisi tampak tumpang tindih: (1) ambil ulang foto close-up di bawah cahaya terang tanpa bayangan setelah membersihkan sisa makanan; (2) lampirkan foto gigi langsung ke Deni AI di halaman Chat (+ Tambah Foto atau Ctrl+V) agar Deni mengevaluasi foto bersama keluhan Anda; dan (3) segera kunjungi dokter gigi apabila muncul nyeri berdenyut, bengkak, perdarahan terus-menerus, atau keraguan yang menetap.",
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
            <div
              data-reveal="up"
              className="mx-auto max-w-3xl text-center"
            >
              <span className="inline-block max-w-full rounded-pill border border-white/20 bg-white/10 px-4 py-1 text-xs font-bold text-zinc-200 [text-wrap:balance]">
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
            </div>

            <div className="mx-auto mt-14 w-full max-w-[1380px] space-y-8">
              {GUIDE_SECTIONS.map((item, index) => {
                const Icon = item.icon;
                const theme =
                  STACKED_CARD_THEMES[index % STACKED_CARD_THEMES.length];
                const anchorId = "anchorId" in item ? item.anchorId : undefined;
                return (
                  <article
                    key={item.step}
                    id={anchorId}
                    data-testid={
                      anchorId === "panduan-hasil-kurang-meyakinkan"
                        ? "panduan-low-confidence-guide"
                        : undefined
                    }
                    data-reveal="up"
                    style={{ top: `${4.5 + index * 1.25}rem` }}
                    className={[
                      "group sticky flex min-h-[250px] items-center rounded-[2rem] border p-7 shadow-xl hover-card sm:min-h-[290px] sm:p-11",
                      theme.card,
                    ].join(" ")}
                  >
                    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center">
                        <span
                          className={[
                            "font-display text-6xl font-extrabold leading-none tracking-tight transition-hover motion-safe:group-hover:scale-[1.03] sm:text-7xl",
                            theme.num,
                          ].join(" ")}
                        >
                          {item.step}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-xs font-bold",
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
                              className="inline-flex h-11 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand px-4 text-sm font-bold text-[var(--color-on-brand)] shadow-sm btn-motion hover:bg-[var(--color-brand-hover)]"
                            >
                              <MessageCircleHeart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Konsultasi Foto ke Deni AI <span className="nudge-arrow ml-1">→</span></span>
                            </Link>
                            <Link
                              href="/scan"
                              className="inline-flex h-11 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/25 bg-white/15 px-4 text-sm font-bold text-white btn-motion hover:bg-white/25"
                            >
                              <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Ambil Ulang Foto di AI Scan</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div data-reveal="up" className="mx-auto mt-14 flex w-full max-w-[1380px] flex-wrap items-center justify-center gap-3 rounded-[1.5rem] border border-white/15 bg-white/10 p-6 text-center">
              <Link
                href="/scan"
                className="inline-flex h-10 min-h-cta items-center justify-center whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-bold text-surface shadow-sm btn-motion hover:bg-brand-dark"
              >
                Mulai AI Scan Sekarang <span className="nudge-arrow ml-1">→</span>
              </Link>
              <Link
                href="/chat"
                className="inline-flex h-10 min-h-touch items-center justify-center whitespace-nowrap rounded-xl bg-accent-deni px-5 text-sm font-bold text-surface shadow-sm btn-motion hover:opacity-95"
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
            <div
              data-reveal="up"
              className="mx-auto max-w-3xl text-center"
            >
              <span className="inline-block max-w-full rounded-pill border border-white/20 bg-white/10 px-4 py-1 text-xs font-bold text-zinc-200 [text-wrap:balance]">
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
            </div>

            <div className="mx-auto mt-14 w-full max-w-[1380px] space-y-8">
              {DENTIST_WORLD_ARTICLES.map((article, index) => {
                const Icon = ARTICLE_ICONS[article.id] ?? BookOpen;
                const theme =
                  STACKED_CARD_THEMES[index % STACKED_CARD_THEMES.length];
                return (
                  <button
                    key={article.id}
                    type="button"
                    data-testid={`dentist-article-card-${article.id}`}
                    onClick={() => setSelectedArticle(article)}
                    data-reveal="up"
                    style={{ top: `${4.5 + index * 1.25}rem` }}
                    className={[
                      "group sticky flex min-h-[250px] w-full cursor-pointer items-center rounded-[2rem] border p-7 text-left shadow-xl hover-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:duration-press sm:min-h-[290px] sm:p-11",
                      theme.card,
                    ].join(" ")}
                  >
                    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
                      <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:w-56 sm:flex-col sm:items-start sm:justify-center">
                        <span
                          className={[
                            "font-display text-6xl font-extrabold leading-none tracking-tight transition-hover motion-safe:group-hover:scale-[1.03] sm:text-7xl",
                            theme.num,
                          ].join(" ")}
                        >
                          {article.stepNumber}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-xs font-bold",
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
                              className="h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
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
            <p data-reveal="up" className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              Kesehatan Gigi Preventif Untuk Semua
            </p>
            <div
              aria-label="DENTIFY."
              data-reveal-group
              className="flex select-none flex-wrap items-baseline justify-center font-display text-[4.5rem] font-black leading-none tracking-tighter sm:text-[8rem] lg:text-[11rem]"
            >
              {Array.from('DENTIFY').map((char, idx) => (
                <span
                  key={`${char}-${idx}`}
                  className={[
                    'inline-block cursor-default text-white transition-lift motion-safe:hover:text-[#9FE7F5] motion-safe:hover:[scale:1.06] motion-safe:hover:[translate:0_-10px]',
                    idx % 2 === 0
                      ? 'motion-safe:hover:[rotate:-3deg]'
                      : 'motion-safe:hover:[rotate:3deg]',
                  ].join(' ')}
                >
                  {char}
                </span>
              ))}
              <span className="inline-block cursor-default text-brand-ring transition-lift motion-safe:hover:text-[#9FE7F5] motion-safe:hover:[rotate:8deg] motion-safe:hover:[scale:1.15] motion-safe:hover:[translate:0_-11px]">
                .
              </span>
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
