'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  buildGoogleMapsDirectionsUrl,
  type ClinicItem,
} from '../services/clinicService';

export interface OsmMapViewProps {
  centerLat: number;
  centerLng: number;
  clinics: ClinicItem[];
  radiusKm?: number;
  locationLabel?: string;
  className?: string;
}

/**
 * Dynamic import tanpa SSR (`ssr: false`) agar Leaflet kompatibel penuh
 * dengan Next.js App Router.
 */
const DynamicOsmMapCanvas = dynamic(() => import('./OsmMapCanvas'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="flex h-72 w-full items-center justify-center rounded-card bg-brand-soft p-6 text-center text-badge font-medium text-brand-dark sm:h-96"
    >
      Memuat peta interaktif OpenStreetMap...
    </div>
  ),
});

/**
 * Komponen pembungkus peta klinik OpenStreetMap.
 */
export function OsmMapView({
  centerLat,
  centerLng,
  clinics,
  radiusKm = 5,
  locationLabel,
  className = '',
}: OsmMapViewProps) {
  const directMapsUrl = buildGoogleMapsDirectionsUrl(
    Number(centerLat.toFixed(5)),
    Number(centerLng.toFixed(5)),
  );

  return (
    <section
      aria-label="Peta Klinik Gigi OpenStreetMap"
      data-testid="osm-map-view"
      className={[
        'overflow-hidden rounded-card border border-border bg-surface p-4 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-badge font-semibold text-brand-dark">
            Peta Fasilitas Kesehatan Gigi • OpenStreetMap
          </p>
          <p className="text-badge text-text-muted">
            Titik pusat: <strong className="text-text">{locationLabel || 'Lokasi Terpilih'}</strong>{' '}
            ({centerLat.toFixed(4)}, {centerLng.toFixed(4)}) • Radius {radiusKm} km •{' '}
            <strong>{clinics.length} klinik</strong> ditemukan
          </p>
        </div>

        <a
          href={directMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-touch items-center rounded-card border border-border bg-bg px-3 py-1.5 text-badge font-semibold text-brand-dark hover:bg-brand-soft"
        >
          Buka di Google Maps ↗
        </a>
      </div>

      <DynamicOsmMapCanvas
        centerLat={centerLat}
        centerLng={centerLng}
        clinics={clinics}
        radiusKm={radiusKm}
      />
    </section>
  );
}

export default OsmMapView;
