/**
 * OpenStreetMap Clinic Finder & Geocode service (/api/v1/clinics - docs/API_SPECS.md §7).
 */

import apiClient from './apiClient';

export interface ClinicItem {
  osm_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  phone?: string | null;
  opening_hours?: string | null;
  osm_url: string;
}

export interface ClinicsResponsePayload {
  success: true;
  source: 'openstreetmap' | 'directory_fallback' | 'fallback';
  data: ClinicItem[];
  fallback?: {
    osm_url: string;
  };
}

export interface GeocodeCandidate {
  display_name: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeResponsePayload {
  success: true;
  data: GeocodeCandidate[];
}

export interface Coordinates {
  lat: number;
  lng: number;
  label?: string;
}

export const INDONESIAN_CITY_COORDINATES: Readonly<Record<string, Coordinates>> = {
  jakarta: { lat: -6.2088, lng: 106.8456, label: 'Jakarta Pusat, DKI Jakarta' },
  bandung: { lat: -6.9175, lng: 107.6191, label: 'Bandung, Jawa Barat' },
  surabaya: { lat: -7.2575, lng: 112.7521, label: 'Surabaya, Jawa Timur' },
  yogyakarta: { lat: -7.79558, lng: 110.36949, label: 'Yogyakarta, DI Yogyakarta' },
  jogja: { lat: -7.79558, lng: 110.36949, label: 'Yogyakarta, DI Yogyakarta' },
  sleman: { lat: -7.7161, lng: 110.3556, label: 'Sleman, DI Yogyakarta' },
  semarang: { lat: -6.9667, lng: 110.4167, label: 'Semarang, Jawa Tengah' },
  medan: { lat: 3.5952, lng: 98.6722, label: 'Medan, Sumatera Utara' },
  makassar: { lat: -5.1477, lng: 119.4327, label: 'Makassar, Sulawesi Selatan' },
  denpasar: { lat: -8.6705, lng: 115.2126, label: 'Denpasar, Bali' },
  malang: { lat: -7.9666, lng: 112.6326, label: 'Malang, Jawa Timur' },
  depok: { lat: -6.4025, lng: 106.7942, label: 'Depok, Jawa Barat' },
  tangerang: { lat: -6.1783, lng: 106.6319, label: 'Tangerang, Banten' },
  bekasi: { lat: -6.2383, lng: 106.9756, label: 'Bekasi, Jawa Barat' },
  bogor: { lat: -6.5971, lng: 106.806, label: 'Bogor, Jawa Barat' },
};

export const DEFAULT_COORDINATES: Coordinates = INDONESIAN_CITY_COORDINATES.yogyakarta;

export async function geocodeLocationQuery(query: string): Promise<GeocodeCandidate[]> {
  const { data } = await apiClient.get<GeocodeResponsePayload>('/clinics/geocode', {
    params: { q: query.trim() },
  });
  return data.data;
}

export async function resolveManualLocationQuery(query: string): Promise<Coordinates> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_COORDINATES;
  }

  // First try backend /clinics/geocode (Nominatim proxy with 24h cache & UA compliance)
  try {
    const candidates = await geocodeLocationQuery(query);
    if (candidates.length > 0) {
      return {
        lat: candidates[0].latitude,
        lng: candidates[0].longitude,
        label: candidates[0].display_name,
      };
    }
  } catch {
    // Fallback to built-in city dictionary below
  }

  for (const [key, coords] of Object.entries(INDONESIAN_CITY_COORDINATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }

  return {
    ...DEFAULT_COORDINATES,
    label: `${query.trim()} (Estimasi Area Yogyakarta)`,
  };
}

export function requestBrowserGeolocation(timeoutMs: number = 8000): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      typeof navigator.geolocation.getCurrentPosition !== 'function'
    ) {
      reject({ code: 'GEOLOCATION_DENIED' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: 'Lokasi GPS Anda Saat Ini',
        });
      },
      () => {
        reject({ code: 'GEOLOCATION_DENIED' });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 60000,
      },
    );
  });
}

export async function fetchNearbyClinics(
  lat: number,
  lng: number,
  radiusKm: number = 5,
): Promise<ClinicsResponsePayload> {
  const { data } = await apiClient.get<ClinicsResponsePayload>('/clinics', {
    params: {
      lat,
      lng,
      radius_km: radiusKm,
    },
  });
  return data;
}
