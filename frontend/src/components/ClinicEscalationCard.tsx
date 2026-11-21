'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClinicCard } from './ClinicCard';
import {
  DEFAULT_COORDINATES,
  fetchNearbyClinics,
  requestBrowserGeolocation,
  type ClinicItem,
} from '../services/clinicService';

export interface ClinicEscalationCardProps {
  initialClinics?: ClinicItem[];
  sourceLabel?: string;
  scanId?: string | null;
  testId?: string;
}

/**
 * Automated Emergency Clinic Escalation Card.
 * Shows up to 3 nearest OpenStreetMap dental clinics plus a "Lihat Semua di Peta" CTA.
 */
export function ClinicEscalationCard({
  initialClinics = [],
  sourceLabel = 'Terdeteksi indikasi darurat. Segera kunjungi dokter gigi terdekat:',
  scanId = null,
  testId = 'clinic-escalation-card',
}: ClinicEscalationCardProps) {
  const [clinics, setClinics] = useState<ClinicItem[]>(initialClinics.slice(0, 3));

  useEffect(() => {
    if (initialClinics.length > 0) {
      setClinics(initialClinics.slice(0, 3));
      return;
    }

    let cancelled = false;
    async function loadTop3() {
      let coords = DEFAULT_COORDINATES;
      try {
        coords = await requestBrowserGeolocation(4000);
      } catch {
        coords = DEFAULT_COORDINATES;
      }
      try {
        const res = await fetchNearbyClinics(coords.lat, coords.lng, 5);
        if (!cancelled && Array.isArray(res.data)) {
          setClinics(res.data.slice(0, 3));
        }
      } catch {
        // Keep the escalation card visible with direct link to /clinics
      }
    }
    void loadTop3();
    return () => {
      cancelled = true;
    };
  }, [initialClinics]);

  const clinicsHref = scanId
    ? `/clinics?from_scan=${encodeURIComponent(scanId)}&urgency=emergency`
    : '/clinics?urgency=emergency';

  return (
    <div
      role="region"
      aria-label="Rekomendasi Klinik Gigi Darurat Otomatis"
      data-testid={testId}
      className="space-y-3 rounded-card border-2 border-status-red bg-bg p-4 sm:p-5"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <span className="inline-block rounded-pill bg-status-red px-3 py-0.5 text-badge font-semibold text-surface">
            Pemicu Otomatis Clinic Finder
          </span>
          <h3 className="mt-1.5 text-card-title text-text">
            3 Klinik Gigi Terdekat untuk Penanganan Segera
          </h3>
          <p className="text-badge text-text-muted">{sourceLabel}</p>
        </div>

        <Link
          href={clinicsHref}
          className="inline-flex h-10 min-h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-status-red px-4 text-sm font-semibold text-surface shadow-sm transition-opacity hover:opacity-95"
        >
          Lihat Semua di Peta →
        </Link>
      </div>

      {clinics.length > 0 && (
        <div className="space-y-2.5 pt-1">
          {clinics.slice(0, 3).map((clinic) => (
            <ClinicCard key={clinic.osm_id} clinic={clinic} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ClinicEscalationCard;
