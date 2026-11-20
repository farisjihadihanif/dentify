'use client';

import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppButton } from './AppButton';
import { ClinicCard } from './ClinicCard';
import { ErrorBanner } from './ErrorBanner';
import { OsmMapView } from './OsmMapView';
import {
  DEFAULT_COORDINATES,
  fetchNearbyClinics,
  requestBrowserGeolocation,
  resolveManualLocationQuery,
  type ClinicItem,
  type Coordinates,
} from '../services/clinicService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';

export const RADIUS_OPTIONS_KM = [2, 5, 10] as const;

export interface ClinicFinderViewProps {
  initialCoords?: Coordinates;
  initialClinics?: ClinicItem[];
  initialManualMode?: boolean;
}

/**
 * Panel utama Pencari Klinik Gigi Terdekat berbasis OpenStreetMap (`DESIGN.md §3.4` & T-205):
 * - Peta interaktif Leaflet + OpenStreetMap tiles (`OsmMapView` dengan `dynamic import` tanpa SSR)
 * - Filter radius (`2 km`, `5 km`, `10 km`)
 * - Deteksi GPS browser (`navigator.geolocation.getCurrentPosition`)
 * - Form input lokasi manual kota/kecamatan apabila izin GPS ditolak (`GEOLOCATION_DENIED`)
 * - Daftar `ClinicCard` terurut dari jarak terdekat + tautan fallback OpenStreetMap
 */
export function ClinicFinderView({
  initialCoords = DEFAULT_COORDINATES,
  initialClinics = [],
  initialManualMode = false,
}: ClinicFinderViewProps) {
  const [coords, setCoords] = useState<Coordinates>(initialCoords);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [clinics, setClinics] = useState<ClinicItem[]>(initialClinics);
  const [fallbackOsmUrl, setFallbackOsmUrl] = useState<string | null>(null);
  const [clinicSource, setClinicSource] = useState<'openstreetmap' | 'directory_fallback' | 'fallback'>('openstreetmap');
  const [isLoading, setIsLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(initialManualMode);
  const [manualCityQuery, setManualCityQuery] = useState('');
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  const loadClinicsAt = useCallback(
    async (targetCoords: Coordinates, targetRadiusKm: number) => {
      setIsLoading(true);
      setUiError(null);
      try {
        const res = await fetchNearbyClinics(targetCoords.lat, targetCoords.lng, targetRadiusKm);
        setClinics(res.data || []);
        setClinicSource(res.source);
        setFallbackOsmUrl(res.fallback?.osm_url || null);
      } catch (error) {
        const mapped =
          error && typeof error === 'object' && 'uiError' in error
            ? (error as { uiError: MappedUiError }).uiError
            : mapApiError(error);
        setUiError(mapped);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const handleUseBrowserGps = async () => {
    setUiError(null);
    setIsLoading(true);
    try {
      const gpsCoords = await requestBrowserGeolocation();
      setCoords(gpsCoords);
      setShowManualForm(false);
      await loadClinicsAt(gpsCoords, radiusKm);
    } catch (error) {
      const mapped = mapApiError(error);
      setUiError(mapped);
      setShowManualForm(true);
      setIsLoading(false);
    }
  };

  const handleManualCitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualCityQuery.trim()) return;
    setIsLoading(true);
    setUiError(null);
    const resolved = await resolveManualLocationQuery(manualCityQuery);
    setCoords(resolved);
    await loadClinicsAt(resolved, radiusKm);
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadiusKm(newRadius);
    await loadClinicsAt(coords, newRadius);
  };

  useEffect(() => {
    if (initialClinics.length === 0) {
      void loadClinicsAt(initialCoords, 5);
    }
  }, [initialClinics.length, initialCoords, loadClinicsAt]);

  return (
    <div className="space-y-6">
      {uiError && (
        <ErrorBanner
          error={uiError}
          onRetry={() => void loadClinicsAt(coords, radiusKm)}
          onSwitchToManualLocation={() => setShowManualForm(true)}
          onDismiss={() => setUiError(null)}
        />
      )}

      <section
        aria-label="Pengaturan Lokasi dan Radius Pencarian"
        className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-sm"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <AppButton
              variant="primary"
              loading={isLoading}
              loadingText="Mencari Klinik..."
              onClick={() => void handleUseBrowserGps()}
            >
              Gunakan Lokasi GPS Saya
            </AppButton>

            <AppButton
              variant="secondary"
              onClick={() => setShowManualForm((prev) => !prev)}
            >
              {showManualForm ? 'Sembunyikan Input Kota' : 'Input Kota / Kecamatan Manual'}
            </AppButton>
          </div>

          <div role="group" aria-label="Filter Radius Pencarian" className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text-muted">Radius:</span>
            {RADIUS_OPTIONS_KM.map((km) => (
              <button
                key={km}
                type="button"
                aria-pressed={radiusKm === km}
                onClick={() => void handleRadiusChange(km)}
                className={[
                  'inline-flex h-9 min-h-touch min-w-touch items-center justify-center whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition-colors',
                  radiusKm === km
                    ? 'border-brand bg-brand text-surface shadow-sm'
                    : 'border-border bg-surface text-text hover:bg-brand-soft',
                ].join(' ')}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>

        {showManualForm && (
          <form
            onSubmit={(e) => void handleManualCitySubmit(e)}
            data-testid="manual-location-form"
            className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row"
          >
            <label htmlFor="manual-city-input" className="sr-only">
              Nama Kecamatan atau Kota
            </label>
            <input
              id="manual-city-input"
              name="city"
              type="text"
              value={manualCityQuery}
              onChange={(e) => setManualCityQuery(e.target.value)}
              placeholder="Contoh: Yogyakarta, Bandung, Jakarta, Surabaya, Medan..."
              className="min-h-cta flex-1 rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <AppButton
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={!manualCityQuery.trim()}
            >
              Cari Klinik di Kota Ini
            </AppButton>
          </form>
        )}
      </section>

      <OsmMapView
        centerLat={coords.lat}
        centerLng={coords.lng}
        clinics={clinics}
        radiusKm={radiusKm}
        locationLabel={coords.label}
      />

      {clinicSource === 'directory_fallback' && fallbackOsmUrl && (
        <div
          role="status"
          data-testid="clinic-directory-fallback-note"
          className="rounded-card border border-brand/25 bg-brand-soft p-4 text-badge text-text"
        >
          <p className="font-semibold text-brand-dark">
            Menampilkan direktori klinik gigi &amp; RSGM terkurasi DentHub.
          </p>
          <p className="mt-1 text-text-muted">
            Server Overpass OpenStreetMap sedang sibuk; Anda juga dapat membuka peta langsung di{' '}
            <a
              href={fallbackOsmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-dark underline"
            >
              OpenStreetMap ↗
            </a>
            .
          </p>
        </div>
      )}

      {clinicSource === 'fallback' && fallbackOsmUrl && (
        <div
          role="status"
          className="rounded-card border border-status-yellow bg-surface p-4 text-badge text-text"
        >
          <p className="font-semibold text-status-yellow">
            Server publik Overpass OpenStreetMap sedang sibuk.
          </p>
          <p className="mt-1 text-text-muted">
            Anda tetap dapat membuka peta fasilitas dokter gigi terdekat secara langsung melalui{' '}
            <a
              href={fallbackOsmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-dark underline"
            >
              tautan pencarian OpenStreetMap ini ↗
            </a>
            .
          </p>
        </div>
      )}

      <section aria-labelledby="heading-daftar-klinik" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="heading-daftar-klinik" className="text-card-title text-text">
            Daftar Klinik &amp; Praktik Dokter Gigi Terdekat ({clinics.length})
          </h2>
          <span className="text-badge text-text-muted">Diurutkan dari jarak terdekat</span>
        </div>

        {clinics.length > 0 ? (
          <div className="space-y-3">
            {clinics.map((clinic) => (
              <ClinicCard key={clinic.osm_id} clinic={clinic} />
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface p-6 text-center text-body text-text-muted">
            {isLoading
              ? 'Sedang mengambil data klinik gigi dari OpenStreetMap...'
              : 'Belum ditemukan klinik gigi terdaftar dalam radius ini. Coba perbesar radius ke 10 km atau pilih kota lain.'}
          </div>
        )}
      </section>
    </div>
  );
}

export default ClinicFinderView;
