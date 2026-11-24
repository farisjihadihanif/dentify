import React from 'react';
import {
  buildGoogleMapsDirectionsUrl,
  type ClinicItem,
} from '../services/clinicService';

export interface ClinicCardProps {
  clinic: ClinicItem;
  className?: string;
}

/**
 * Dental clinic card reused on /clinics and in ClinicEscalationCard on /scan and /chat.
 * External route navigation links open Google Maps turn-by-turn directions directly.
 */
export function ClinicCard({ clinic, className = '' }: ClinicCardProps) {
  const directionsUrl = buildGoogleMapsDirectionsUrl(clinic.latitude, clinic.longitude);

  return (
    <article
      data-testid="clinic-card"
      data-reveal="up"
      data-reveal-async
      className={[
        'hover-card flex flex-col justify-between gap-4 rounded-card border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-card-title text-text">{clinic.name}</h3>
          <span className="rounded-pill bg-brand-soft px-2.5 py-0.5 text-badge font-semibold text-brand-dark">
            {clinic.distance_km.toFixed(1)} km
          </span>
        </div>

        <p className="text-badge text-text-muted">
          {clinic.address || 'Alamat lengkap tersedia di OpenStreetMap'}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-badge text-text-muted">
          {clinic.opening_hours && (
            <span>
              <strong className="text-text">Jam buka:</strong> {clinic.opening_hours}
            </span>
          )}
          {clinic.phone && (
            <span>
              <strong className="text-text">Telp:</strong> {clinic.phone}
            </span>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 min-h-cta min-w-touch items-center justify-center whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-semibold text-surface shadow-sm btn-motion hover:bg-brand-dark"
        >
          Buka Rute Peta <span className="nudge-arrow ml-1">→</span>
        </a>
      </div>
    </article>
  );
}

export default ClinicCard;
