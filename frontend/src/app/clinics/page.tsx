import React from 'react';
import { ClinicFinderView } from '../../components/ClinicFinderView';

/**
 * Halaman Klinik (`src/app/clinics/page.tsx`, docs/DESIGN.md §3.4):
 * Fokus pada pencarian lokasi klinik & dokter gigi terdekat dengan peta interaktif OpenStreetMap & Leaflet.
 */
export default function ClinicsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <section
        aria-labelledby="heading-lokasi-klinik"
        data-testid="clinics-section-locations"
        className="space-y-6"
      >
        <div>
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-badge font-bold text-brand-dark">
            Lokasi Klinik • OpenStreetMap &amp; Leaflet
          </span>
          <h1 id="heading-lokasi-klinik" className="mt-2 text-screen-title text-text sm:text-3xl">
            Cari Lokasi Klinik &amp; Dokter Gigi Terdekat
          </h1>
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
