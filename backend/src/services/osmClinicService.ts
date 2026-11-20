import { getEnv } from '../config/env';

export interface ClinicItem {
  osm_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  phone: string | null;
  opening_hours: string | null;
  osm_url: string;
}

export interface ClinicsSearchResult {
  source: 'openstreetmap' | 'fallback';
  data: ClinicItem[];
  fallback?: { osm_url: string };
}

export interface GeocodeCandidate {
  display_name: string;
  latitude: number;
  longitude: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CLINICS_TTL_MS = 15 * 60 * 1000; // 15 minutes
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OVERPASS_TIMEOUT_MS = 8000; // 8 seconds
const MAX_CACHE_ENTRIES = 500;

const clinicsCache = new Map<string, CacheEntry<ClinicItem[]>>();
const geocodeCache = new Map<string, CacheEntry<GeocodeCandidate[]>>();
let lastNominatimCallMs = 0;

export function clearOsmCaches(): void {
  clinicsCache.clear();
  geocodeCache.clear();
  lastNominatimCallMs = 0;
}

function setBoundedCache<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
): void {
  if (map.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function getCached<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function buildOverpassQuery(lat: number, lng: number, radiusMeters: number): string {
  return `[out:json][timeout:8];
(
  node["amenity"="dentist"](around:${radiusMeters},${lat},${lng});
  way["amenity"="dentist"](around:${radiusMeters},${lat},${lng});
  relation["amenity"="dentist"](around:${radiusMeters},${lat},${lng});
  node["healthcare"="dentist"](around:${radiusMeters},${lat},${lng});
  way["healthcare"="dentist"](around:${radiusMeters},${lat},${lng});
  relation["healthcare"="dentist"](around:${radiusMeters},${lat},${lng});
  node["amenity"="clinic"]["healthcare:speciality"~"dentistry|dental",i](around:${radiusMeters},${lat},${lng});
  way["amenity"="clinic"]["healthcare:speciality"~"dentistry|dental",i](around:${radiusMeters},${lat},${lng});
  relation["amenity"="clinic"]["healthcare:speciality"~"dentistry|dental",i](around:${radiusMeters},${lat},${lng});
);
out center;`;
}

function formatOsmAddress(tags?: Record<string, string>): string | null {
  if (!tags) return null;
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:street'],
    tags['addr:housenumber'] ? `No. ${tags['addr:housenumber']}` : undefined,
    tags['addr:suburb'] ?? tags['addr:village'],
    tags['addr:city'] ?? tags['addr:district'],
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function searchNearbyClinics(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ClinicsSearchResult> {
  // ~1 km grid cell cache key (0.01 deg ~ 1.1 km)
  const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusKm}`;
  const cached = getCached(clinicsCache, cacheKey);
  if (cached) {
    return { source: 'openstreetmap', data: cached };
  }

  const env = getEnv();
  const radiusMeters = Math.round(radiusKm * 1000);
  const query = buildOverpassQuery(lat, lng, radiusMeters);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

  try {
    const response = await fetch(env.overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': env.osmUserAgent,
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    const seen = new Set<string>();
    const items: ClinicItem[] = [];

    for (const el of json.elements ?? []) {
      const osmId = `${el.type}/${el.id}`;
      if (seen.has(osmId)) continue;
      seen.add(osmId);

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') continue;

      const tags = el.tags ?? {};
      items.push({
        osm_id: osmId,
        name: tags.name?.trim() || 'Klinik Gigi (tanpa nama)',
        address: formatOsmAddress(tags),
        latitude: elLat,
        longitude: elLng,
        distance_km: haversineDistanceKm(lat, lng, elLat, elLng),
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        opening_hours: tags.opening_hours ?? null,
        osm_url: `https://www.openstreetmap.org/?mlat=${elLat}&mlon=${elLng}#map=17/${elLat}/${elLng}`,
      });
    }

    items.sort((a, b) => a.distance_km - b.distance_km);
    setBoundedCache(clinicsCache, cacheKey, items, CLINICS_TTL_MS);

    return {
      source: 'openstreetmap',
      data: items,
    };
  } catch {
    return {
      source: 'fallback',
      data: [],
      fallback: {
        osm_url: `https://www.openstreetmap.org/#map=15/${lat}/${lng}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function geocodePlace(q: string): Promise<GeocodeCandidate[]> {
  const normalized = q.trim().toLowerCase();
  const cached = getCached(geocodeCache, normalized);
  if (cached) {
    return cached;
  }

  // Respect Nominatim usage policy: <= 1 req/s
  const now = Date.now();
  const elapsed = now - lastNominatimCallMs;
  if (lastNominatimCallMs > 0 && elapsed < 1000 && process.env.NODE_ENV !== 'test') {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastNominatimCallMs = Date.now();

  const env = getEnv();
  const url = new URL(env.nominatimUrl);
  url.searchParams.set('q', q.trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'id');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': env.osmUserAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const rows = (await response.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;

    const candidates: GeocodeCandidate[] = [];
    for (const row of rows.slice(0, 5)) {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (row.display_name && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        candidates.push({
          display_name: row.display_name,
          latitude,
          longitude,
        });
      }
    }

    setBoundedCache(geocodeCache, normalized, candidates, GEOCODE_TTL_MS);
    return candidates;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
