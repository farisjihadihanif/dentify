import React from 'react';
import Link from 'next/link';
import {
  Camera,
  MessageCircleHeart,
  MapPin,
  UserCheck,
  Download,
  Sun,
} from 'lucide-react';
import { MedicalDisclaimerBanner } from '../../components/MedicalDisclaimerBanner';

const GUIDE_SECTIONS = [
  {
    step: '1',
    title: 'Daftar & Masuk ke Akun DentHub',
    description:
      'Untuk menggunakan fitur AI Dental Scan dan mengelola Profil Anda, masuklah ke akun DentHub melalui menu Profil atau halaman Login. Halaman Beranda, Tanya Deni, Klinik, dan Panduan tetap dapat dibaca kapan saja.',
    icon: UserCheck,
  },
  {
    step: '2',
    title: 'Tips Mengambil Foto Gigi yang Akurat',
    description:
      'Gunakan pencahayaan ruangan yang terang (atau lampu flash ponsel), bersihkan sisa makanan terlebih dahulu, buka mulut dengan jelas, dan pastikan kamera fokus pada area gigi atau gusi yang ingin diperiksa.',
    icon: Sun,
  },
  {
    step: '3',
    title: 'Gunakan Fitur AI Scan & Riwayat di Sidebar',
    description:
      'Di halaman Scan, Anda dapat memotret lewat Kamera Langsung atau menyertakan file foto (JPG/PNG/WEBP ≤ 5 MB). Seluruh riwayat scan tersimpan rapi di Sidebar kiri dan dapat dibuka kembali kapan saja.',
    icon: Camera,
  },
  {
    step: '4',
    title: 'Unduh Hasil Laporan Screening',
    description:
      'Setelah analisis selesai, klik tombol "Unduh Hasil" untuk menyimpan kartu laporan lengkap (berisi kondisi terdeteksi, skor keyakinan AI, tingkat urgensi, serta daftar anjuran Do’s & Don’ts) ke perangkat Anda.',
    icon: Download,
  },
  {
    step: '5',
    title: 'Konsultasi dengan Maskot AI Deni',
    description:
      'Klik maskot Deni yang mengambang di pojok kanan bawah layar ("Tanya Deni") atau menu Deni di Navbar untuk berkonsultasi mengenai hasil scan maupun keluhan gigi harian Anda.',
    icon: MessageCircleHeart,
  },
  {
    step: '6',
    title: 'Temukan Klinik Gigi Terdekat',
    description:
      'Buka menu Klinik untuk mempelajari informasi Dunia Dentist serta mencari lokasi praktik dokter gigi terdekat berbasis OpenStreetMap melalui GPS otomatis atau pencarian kota manual.',
    icon: MapPin,
  },
] as const;

export default function PanduanPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 pb-12 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      <div className="text-center">
        <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
          Pusat Bantuan • Panduan Pengguna DentHub
        </span>
        <h1 className="mt-2 text-2xl font-bold text-text sm:text-3xl">
          Panduan Lengkap Penggunaan Aplikasi DentHub AI
        </h1>
        <p className="mx-auto mt-1.5 max-w-2xl text-sm text-text-muted sm:text-base">
          Pelajari cara melakukan screening kesehatan gigi mandiri, mengunduh laporan hasil,
          berkonsultasi dengan Deni, hingga menemukan klinik dokter gigi terdekat.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {GUIDE_SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.step}
              className="flex items-start gap-4 rounded-card border border-border bg-surface p-6 shadow-sm"
            >
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-surface">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <span className="text-badge font-bold text-brand-dark">Langkah {item.step}</span>
                <h2 className="text-card-title text-text">{item.title}</h2>
                <p className="text-badge leading-relaxed text-text-muted">{item.description}</p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 rounded-card border border-border bg-surface p-6 text-center shadow-sm">
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

      <MedicalDisclaimerBanner />
    </main>
  );
}
