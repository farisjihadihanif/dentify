import mongoose from 'mongoose';
import { getEnv } from '../config/env';
import { CLINIC_DIRECTORY_SEED } from '../constants/clinicDirectorySeed';
import { ClinicDirectory } from '../models/ClinicDirectory';

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
  source: 'openstreetmap' | 'directory_fallback' | 'fallback';
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
const OVERPASS_MIRROR_TIMEOUT_MS = 4500; // short per-mirror timeout for fast failover
const NOMINATIM_TIMEOUT_MS = 8000;
const MAX_CACHE_ENTRIES = 500;

export const OVERPASS_MIRRORS: readonly string[] = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

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
  return `[out:json][timeout:6];
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

async function fetchOverpassMirror(
  mirrorUrl: string,
  query: string,
  userAgent: string,
): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_MIRROR_TIMEOUT_MS);
  try {
    const response = await fetch(mirrorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const json = (await response.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } finally {
    clearTimeout(timer);
  }
}

async function searchSeededDirectoryFallback(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ClinicItem[]> {
  let records: Array<{
    osm_id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    phone: string | null;
    opening_hours: string | null;
    osm_url: string;
  }> = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const dbDocs = await ClinicDirectory.find().lean();
      if (dbDocs.length > 0) {
        records = dbDocs;
      }
    } catch {
      // Fall back to curated in-memory seed below
    }
  }

  if (records.length === 0) {
    records = [...CLINIC_DIRECTORY_SEED];
  }

  const scored: ClinicItem[] = records
    .map((doc) => ({
      osm_id: doc.osm_id,
      name: doc.name,
      address: doc.address,
      latitude: doc.latitude,
      longitude: doc.longitude,
      distance_km: haversineDistanceKm(lat, lng, doc.latitude, doc.longitude),
      phone: doc.phone ?? null,
      opening_hours: doc.opening_hours ?? null,
      osm_url: doc.osm_url,
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const withinRadius = scored.filter((item) => item.distance_km <= radiusKm);
  if (withinRadius.length > 0) {
    return withinRadius;
  }

  // If user is near a seeded Indonesian metro area (within 25 km), still return nearest regional RSGM/clinics
  const withinMetro = scored.filter((item) => item.distance_km <= 25);
  return withinMetro.slice(0, 6);
}

export async function searchNearbyClinics(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ClinicsSearchResult> {
  const cacheKey = `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusKm}`;
  const cached = getCached(clinicsCache, cacheKey);
  if (cached) {
    return { source: 'openstreetmap', data: cached };
  }

  const env = getEnv();
  const radiusMeters = Math.round(radiusKm * 1000);
  const query = buildOverpassQuery(lat, lng, radiusMeters);

  // Rotate across configured primary mirror + backup Overpass mirrors
  const mirrors = Array.from(new Set([env.overpassUrl, ...OVERPASS_MIRRORS]));
  let elements: OverpassElement[] | null = null;

  for (const mirrorUrl of mirrors) {
    try {
      const resElements = await fetchOverpassMirror(mirrorUrl, query, env.osmUserAgent);
      elements = resElements;
      if (resElements.length > 0) {
        break;
      }
    } catch {
      // Try next mirror
    }
  }

  if (elements && elements.length > 0) {
    const seen = new Set<string>();
    const items: ClinicItem[] = [];

    for (const el of elements) {
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

    if (items.length > 0) {
      items.sort((a, b) => a.distance_km - b.distance_km);
      setBoundedCache(clinicsCache, cacheKey, items, CLINICS_TTL_MS);
      return {
        source: 'openstreetmap',
        data: items,
      };
    }
  }

  // Fallback to seeded Indonesian dental clinic & RSGM directory so /clinics stays populated
  const directoryItems = await searchSeededDirectoryFallback(lat, lng, radiusKm);
  const osmFallbackUrl = `https://www.openstreetmap.org/#map=15/${lat}/${lng}`;

  if (directoryItems.length > 0) {
    return {
      source: 'directory_fallback',
      data: directoryItems,
      fallback: { osm_url: osmFallbackUrl },
    };
  }

  return {
    source: 'fallback',
    data: [],
    fallback: { osm_url: osmFallbackUrl },
  };
}

export async function geocodePlace(q: string): Promise<GeocodeCandidate[]> {
  const normalized = q.trim().toLowerCase();
  const cached = getCached(geocodeCache, normalized);
  if (cached) {
    return cached;
  }

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
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

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
