import React from 'react';
import { ShieldAlert, Sparkles, Stethoscope, Clock } from 'lucide-react';
import { ClinicFinderView } from '../../components/ClinicFinderView';

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
 * Halaman Klinik (`src/app/clinics/page.tsx`) — Tepat 2 Section:
 * 1. Section 1 (Bagian Atas — Informasi tentang Dunia Dentist): Edukasi seputar dunia kedokteran gigi,
 *    jenis tindakan klinik, tanda darurat medis, dan persiapan kunjungan.
 * 2. Section 2 (Bagian Bawah — Lokasi Klinik): Peta interaktif Leaflet OpenStreetMap (`OsmMapView`),
 *    deteksi GPS browser, filter radius, pencarian manual kota/kecamatan, dan daftar kartu klinik terdekat.
 */
export default function ClinicsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pb-12 pt-24 sm:px-6 sm:pt-28 lg:px-8">
      {/* =====================================================================
          SECTION 1: Bagian Atas — Informasi tentang Dunia Dentist
         ===================================================================== */}
      <section
        aria-labelledby="heading-dunia-dentist"
        data-testid="clinics-section-1-dentist-world"
        className="space-y-6 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8"
      >
        <div className="text-center sm:text-left">
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            Edukasi Kesehatan Gigi • Dunia Dentist
          </span>
          <h1 id="heading-dunia-dentist" className="mt-2 text-2xl font-bold text-text sm:text-3xl">
            Informasi Seputar Dunia Dentist &amp; Perawatan Klinik Gigi
          </h1>
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
                className="flex items-start gap-4 rounded-card border border-border bg-bg p-5"
              >
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand-dark">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-badge font-bold text-brand-dark">{card.category}</span>
                  <h2 className="text-card-title text-text">{card.title}</h2>
                  <p className="text-badge leading-relaxed text-text-muted">{card.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          SECTION 2: Bagian Bawah — Lokasi Klinik & Dokter Gigi Terdekat
         ===================================================================== */}
      <section
        aria-labelledby="heading-lokasi-klinik"
        data-testid="clinics-section-2-locations"
        className="space-y-6"
      >
        <div>
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-badge font-bold text-brand-dark">
            Lokasi Klinik • OpenStreetMap &amp; Leaflet
          </span>
          <h2 id="heading-lokasi-klinik" className="mt-2 text-screen-title text-text sm:text-3xl">
            Cari Lokasi Klinik &amp; Dokter Gigi Terdekat
          </h2>
          <p className="mt-1 text-body text-text-muted">
            Gunakan GPS perangkat Anda atau ketik nama kota/kecamatan untuk menampilkan peta dan
            rute klinik gigi terdekat secara akurat.
          </p>
        </div>

        <ClinicFinderView />
      </section>
    </main>
  );
}
