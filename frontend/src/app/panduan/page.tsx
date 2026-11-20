'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
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

const GUIDE_SECTIONS = [
  {
    step: '01',
    title: 'Daftar & Masuk ke Akun DentHub',
    description:
      'Untuk menggunakan fitur AI Dental Scan dan mengelola Profil Anda, masuklah ke akun DentHub melalui menu Profil atau halaman Login. Halaman Beranda, Tanya Deni, Klinik, dan Panduan tetap dapat dibaca kapan saja.',
    icon: UserCheck,
  },
  {
    step: '02',
    title: 'Tips Mengambil Foto Gigi yang Akurat',
    description:
      'Gunakan pencahayaan ruangan yang terang (atau lampu flash ponsel), bersihkan sisa makanan terlebih dahulu, buka mulut dengan jelas, dan pastikan kamera fokus pada area gigi atau gusi yang ingin diperiksa.',
    icon: Sun,
  },
  {
    step: '03',
    title: 'Gunakan Fitur AI Scan & Riwayat di Sidebar',
    description:
      'Di halaman Scan, Anda dapat memotret lewat Kamera Langsung atau menyertakan file foto (JPG/PNG/WEBP ≤ 5 MB). Seluruh riwayat scan tersimpan rapi di Sidebar kiri dan dapat dibuka kembali kapan saja.',
    icon: Camera,
  },
  {
    step: '04',
    title: 'Unduh Hasil Laporan Screening',
    description:
      'Setelah analisis selesai, klik tombol "Unduh Hasil" untuk menyimpan kartu laporan lengkap (berisi kondisi terdeteksi, skor keyakinan AI, tingkat urgensi, serta daftar anjuran Do’s & Don’ts) ke perangkat Anda.',
    icon: Download,
  },
  {
    step: '05',
    title: 'Konsultasi dengan Maskot AI Deni',
    description:
      'Klik maskot Deni yang mengambang di pojok kanan bawah layar ("Tanya Deni") atau menu Deni di Navbar untuk berkonsultasi mengenai hasil scan maupun keluhan gigi harian Anda.',
    icon: MessageCircleHeart,
  },
  {
    step: '06',
    title: 'Temukan Klinik Gigi Terdekat',
    description:
      'Buka menu Klinik untuk mencari lokasi praktik dokter gigi terdekat berbasis OpenStreetMap melalui GPS otomatis atau pencarian kota manual.',
    icon: MapPin,
  },
] as const;

const DENTIST_WORLD_CARDS = [
  {
    title: 'Pemeriksaan Rutin & Scaling (Tiap 6 Bulan)',
    category: 'Perawatan Preventif',
    description:
      'Karang gigi (calculus) yang telah mengeras tidak dapat dibersihkan hanya dengan sikat gigi biasa. Dokter gigi menggunakan ultrasonic scaler untuk membersihkan plak dan karang tanpa merusak email gigi.',
    icon: Sparkles,
  },
  {
    title: 'Penambalan Karies & Konservasi Gigi',
    category: 'Tindakan Restoratif',
    description:
      'Lubang gigi (karies) tahap awal yang ditangani sedini mungkin dapat ditambal dengan bahan komposit sewarna gigi dalam satu kali kunjungan, sebelum infeksi mencapai jaringan saraf (pulpa).',
    icon: Stethoscope,
  },
  {
    title: 'Tanda Darurat yang Harus Segera ke Klinik',
    category: 'Waspada Darurat Medis',
    description:
      'Segera kunjungi dokter gigi apabila Anda mengalami nyeri gigi berdenyut hebat (nyut-nyutan) yang mengganggu tidur, pembengkakan pada gusi atau pipi, keluarnya nanah (abses), atau pendarahan gusi yang tidak berhenti.',
    icon: ShieldAlert,
  },
  {
    title: 'Persiapan Sebelum Berkunjung ke Dokter Gigi',
    category: 'Tips Pasien Cerdas',
    description:
      'Unduh hasil laporan screening DentHub Anda untuk ditunjukkan kepada dokter gigi, sikat gigi secara lembut sebelum berangkat, dan catat riwayat alergi obat atau keluhan yang Anda rasakan.',
    icon: Clock,
  },
] as const;

/**
 * Halaman Panduan (`src/app/panduan/page.tsx`, docs/DESIGN.md §3.6):
 * - Section 1: Alur panduan vertikal satu kolom dengan animasi scroll seperti Home Section 2.
 * - Section 2: Informasi Seputar Dunia Dentist & Perawatan Klinik Gigi.
 */
export default function PanduanPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {/* =====================================================================
          SECTION 1: Panduan Penggunaan Aplikasi (Alur Vertikal Satu Kolom)
         ===================================================================== */}
      <section aria-labelledby="heading-panduan-aplikasi" data-testid="panduan-section-1-steps">
        <div className="text-center">
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            Pusat Bantuan • Panduan Pengguna DentHub
          </span>
          <h1
            id="heading-panduan-aplikasi"
            className="mt-2 text-2xl font-bold text-text sm:text-3xl"
          >
            Panduan Lengkap Penggunaan Aplikasi DentHub AI
          </h1>
          <p className="mx-auto mt-1.5 max-w-2xl text-sm text-text-muted sm:text-base">
            Pelajari cara melakukan screening kesehatan gigi mandiri, mengunduh laporan hasil,
            berkonsultasi dengan Deni, hingga menemukan klinik dokter gigi terdekat.
          </p>
        </div>

        <div className="relative mt-10 space-y-6 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-0.5 before:rounded-pill before:bg-brand/30 sm:before:left-6">
          {GUIDE_SECTIONS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.article
                key={item.step}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.35,
                  delay: prefersReducedMotion ? 0 : index * 0.06,
                }}
                className="group relative flex items-start gap-4 pl-1 sm:gap-5 sm:pl-2"
              >
                <div className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-surface shadow-sm ring-4 ring-bg transition-transform duration-200 group-hover:scale-110 sm:h-11 sm:w-11">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                <div className="flex-1 rounded-card border border-border bg-surface p-5 shadow-sm transition-all duration-200 group-hover:border-brand/50 group-hover:shadow-md sm:p-6">
                  <span className="inline-block rounded-pill bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-dark">
                    Langkah {item.step}
                  </span>
                  <h2 className="mt-2 text-card-title text-text">{item.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                    {item.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-sm">
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
          SECTION 2: Informasi Seputar Dunia Dentist & Perawatan Klinik Gigi
         ===================================================================== */}
      <section
        aria-labelledby="heading-dunia-dentist"
        data-testid="panduan-section-2-dentist-world"
        className="space-y-6 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <div className="text-center sm:text-left">
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            Edukasi Kesehatan Gigi • Dunia Dentist
          </span>
          <h2 id="heading-dunia-dentist" className="mt-2 text-2xl font-bold text-text sm:text-3xl">
            Informasi Seputar Dunia Dentist &amp; Perawatan Klinik Gigi
          </h2>
          <p className="mt-1.5 max-w-3xl text-sm text-text-muted sm:text-base">
            Kenali kapan Anda memerlukan perawatan dokter gigi profesional, jenis tindakan yang
            tersedia di klinik, serta tanda bahaya yang membutuhkan penanganan segera.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DENTIST_WORLD_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="flex items-start gap-4 rounded-card border border-border bg-bg p-5 transition-colors hover:border-brand/40"
              >
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-dark">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <span className="text-badge font-bold text-brand-dark">{card.category}</span>
                  <h3 className="text-card-title text-text">{card.title}</h3>
                  <p className="text-badge leading-relaxed text-text-muted">{card.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
