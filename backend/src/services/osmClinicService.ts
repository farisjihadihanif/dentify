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
  google_maps_url?: string;
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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
const NOMINATIM_TIMEOUT_MS = 6000;
const PHOTON_TIMEOUT_MS = 5000;
const MAX_CACHE_ENTRIES = 500;
const PHOTON_API_URL = 'https://photon.komoot.io/api/';

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

function isWithinIndonesia(lat: number, lng: number): boolean {
  return lat >= -11.5 && lat <= 6.5 && lng >= 94.5 && lng <= 141.5;
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
  node["amenity"="clinic"]["name"~"gigi|dental|dentist|rsgm",i](around:${radiusMeters},${lat},${lng});
  way["amenity"="clinic"]["name"~"gigi|dental|dentist|rsgm",i](around:${radiusMeters},${lat},${lng});
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

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

interface NominatimRow {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
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

/**
 * Live OpenStreetMap Nominatim + Photon search bounded around any Indonesian [lat, lng].
 * Enables nationwide clinic lookup across any kecamatan/kelurahan/kota/kabupaten even
 * when Overpass mirrors are busy or sparse.
 */
async function searchClinicsViaNominatimAndPhoton(
  lat: number,
  lng: number,
  radiusKm: number,
  userAgent: string,
  nominatimUrl: string,
): Promise<ClinicItem[]> {
  const degLat = Math.max(0.03, radiusKm / 111.0);
  const degLng = Math.max(0.03, radiusKm / (111.0 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))));
  const minLng = lng - degLng;
  const maxLng = lng + degLng;
  const minLat = lat - degLat;
  const maxLat = lat + degLat;

  const queries = ['dokter gigi', 'klinik gigi', 'rumah sakit gigi', 'puskesmas'];
  const seen = new Set<string>();
  const collected: ClinicItem[] = [];

  const pushCandidate = (item: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  }) => {
    if (seen.has(item.id)) return;
    const dist = haversineDistanceKm(lat, lng, item.lat, item.lng);
    if (dist > Math.max(radiusKm * 1.5, 15)) return;
    seen.add(item.id);
    const directions = buildGoogleMapsDirectionsUrl(item.lat, item.lng);
    collected.push({
      osm_id: item.id,
      name: item.name,
      address: item.address,
      latitude: item.lat,
      longitude: item.lng,
      distance_km: dist,
      phone: null,
      opening_hours: null,
      osm_url: directions,
      google_maps_url: directions,
    });
  };

  // Query Photon Komoot (fast, OSM-backed, supports lat/lon bias + bbox)
  const photonTasks = queries.map(async (term) => {
    const url = new URL(PHOTON_API_URL);
    url.searchParams.set('q', term);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('bbox', `${minLng},${minLat},${maxLng},${maxLat}`);
    url.searchParams.set('limit', '8');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS);
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as { features?: PhotonFeature[] };
      for (const f of json.features ?? []) {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const [fLng, fLat] = coords;
        const props = f.properties ?? {};
        const name = props.name?.trim();
        if (!name) continue;
        const addrParts = [
          props.street,
          props.housenumber,
          props.district,
          props.city ?? props.county,
          props.state,
        ].filter(Boolean);
        pushCandidate({
          id: `photon/${props.osm_type ?? 'n'}/${props.osm_id ?? `${fLat.toFixed(4)}_${fLng.toFixed(4)}`}`,
          name,
          address: addrParts.length > 0 ? addrParts.join(', ') : null,
          lat: fLat,
          lng: fLng,
        });
      }
    } catch {
      // ignore mirror error
    } finally {
      clearTimeout(timer);
    }
  });

  await Promise.all(photonTasks);

  // If Photon returned nothing, try bounded Nominatim search for dental terms
  if (collected.length === 0) {
    for (const term of ['dokter gigi', 'klinik gigi']) {
      const url = new URL(nominatimUrl);
      url.searchParams.set('q', term);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '8');
      url.searchParams.set('countrycodes', 'id');
      url.searchParams.set('viewbox', `${minLng},${maxLat},${maxLng},${minLat}`);
      url.searchParams.set('bounded', '1');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const rows = (await res.json()) as NominatimRow[];
        for (const row of rows) {
          const rLat = Number(row.lat);
          const rLng = Number(row.lon);
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
          const display = row.display_name?.trim() || '';
          const title = row.name?.trim() || display.split(',')[0]?.trim() || 'Klinik Gigi';
          pushCandidate({
            id: `nominatim/${row.osm_type ?? 'node'}/${row.osm_id ?? `${rLat.toFixed(4)}_${rLng.toFixed(4)}`}`,
            name: title,
            address: display || null,
            lat: rLat,
            lng: rLng,
          });
        }
      } catch {
        // ignore
      } finally {
        clearTimeout(timer);
      }
    }
  }

  collected.sort((a, b) => a.distance_km - b.distance_km);
  return collected;
}

async function searchSeededDirectoryFallback(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ClinicItem[]> {
  if (!isWithinIndonesia(lat, lng)) {
    return [];
  }

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
      osm_url: buildGoogleMapsDirectionsUrl(doc.latitude, doc.longitude),
      google_maps_url: buildGoogleMapsDirectionsUrl(doc.latitude, doc.longitude),
    }))
    .sort((a, b) => a.distance_km - b.distance_km);

  const withinRadius = scored.filter((item) => item.distance_km <= radiusKm);
  if (withinRadius.length > 0) {
    return withinRadius;
  }

  // Broad regional matching (up to 150 km) so any Indonesian kecamatan/kota still gets nearest regional RSGM/clinics
  const withinRegion = scored.filter((item) => item.distance_km <= 150);
  return withinRegion.slice(0, 6);
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

  // 1. Rotate across configured primary + backup Overpass mirrors
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
      const directions = buildGoogleMapsDirectionsUrl(elLat, elLng);
      items.push({
        osm_id: osmId,
        name: tags.name?.trim() || 'Klinik Gigi (tanpa nama)',
        address: formatOsmAddress(tags),
        latitude: elLat,
        longitude: elLng,
        distance_km: haversineDistanceKm(lat, lng, elLat, elLng),
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        opening_hours: tags.opening_hours ?? null,
        osm_url: directions,
        google_maps_url: directions,
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

  // 2. Live Photon + Nominatim bounded search (supports any Indonesian kecamatan/kelurahan/kota)
  const liveSearchItems = await searchClinicsViaNominatimAndPhoton(
    lat,
    lng,
    radiusKm,
    env.osmUserAgent,
    env.nominatimUrl,
  );
  if (liveSearchItems.length > 0) {
    setBoundedCache(clinicsCache, cacheKey, liveSearchItems, CLINICS_TTL_MS);
    return {
      source: 'openstreetmap',
      data: liveSearchItems,
    };
  }

  // 3. Fallback to nationwide curated Indonesian dental clinic & RSGM directory
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

/**
 * Generates clean normalized variants for Indonesian subdistrict/city queries
 * (e.g. "Kecamatan Coblong, Kota Bandung" -> ["Kecamatan Coblong, Kota Bandung", "Coblong, Bandung", "Bandung"]).
 */
export function buildIndonesianGeocodeVariants(rawQuery: string): string[] {
  const trimmed = rawQuery.trim().replace(/\s+/g, ' ');
  if (!trimmed) return [];

  const strippedPrefixes = trimmed
    .replace(/\b(kecamatan|kec\.?|kelurahan|kel\.?|desa|kabupaten|kab\.?|kota)\b/gi, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^,\s*|\s*,$/g, '')
    .trim();

  const variants: string[] = [trimmed];
  if (strippedPrefixes && strippedPrefixes.toLowerCase() !== trimmed.toLowerCase()) {
    variants.push(strippedPrefixes);
  }
  if (!/indonesia/i.test(strippedPrefixes || trimmed)) {
    variants.push(`${strippedPrefixes || trimmed}, Indonesia`);
  }

  // If user typed "Kecamatan X, Kota Y", also keep "Kota Y" as last resort if exact fails
  const commaParts = strippedPrefixes
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) {
    variants.push(commaParts[commaParts.length - 1]);
  }

  return Array.from(new Set(variants));
}

async function fetchNominatimCandidates(
  query: string,
  nominatimUrl: string,
  userAgent: string,
): Promise<GeocodeCandidate[]> {
  const url = new URL(nominatimUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'id');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const rows = (await response.json()) as NominatimRow[];
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
    return candidates;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPhotonGeocodeCandidates(
  query: string,
  userAgent: string,
): Promise<GeocodeCandidate[]> {
  const url = new URL(PHOTON_API_URL);
  url.searchParams.set('q', `${query}, Indonesia`);
  url.searchParams.set('limit', '5');
  url.searchParams.set('bbox', '94.5,-11.5,141.5,6.5');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return [];

    const json = (await response.json()) as { features?: PhotonFeature[] };
    const candidates: GeocodeCandidate[] = [];
    for (const f of json.features ?? []) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [longitude, latitude] = coords;
      if (!isWithinIndonesia(latitude, longitude)) continue;
      const props = f.properties ?? {};
      const parts = [props.name, props.district, props.city ?? props.county, props.state, 'Indonesia'].filter(
        Boolean,
      );
      if (parts.length > 0) {
        candidates.push({
          display_name: Array.from(new Set(parts)).join(', '),
          latitude,
          longitude,
        });
      }
    }
    return candidates.slice(0, 5);
  } catch {
    return [];
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

  const now = Date.now();
  const elapsed = now - lastNominatimCallMs;
  if (lastNominatimCallMs > 0 && elapsed < 1000 && process.env.NODE_ENV !== 'test') {
    await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastNominatimCallMs = Date.now();

  const env = getEnv();
  const variants = buildIndonesianGeocodeVariants(q);

  for (const variant of variants) {
    const nomCandidates = await fetchNominatimCandidates(variant, env.nominatimUrl, env.osmUserAgent);
    if (nomCandidates.length > 0) {
      setBoundedCache(geocodeCache, normalized, nomCandidates, GEOCODE_TTL_MS);
      return nomCandidates;
    }
  }

  // Fallback to Photon geocoder for Indonesian subdistricts/kecamatan/kelurahan
  for (const variant of variants.slice(0, 2)) {
    const photonCandidates = await fetchPhotonGeocodeCandidates(variant, env.osmUserAgent);
    if (photonCandidates.length > 0) {
      setBoundedCache(geocodeCache, normalized, photonCandidates, GEOCODE_TTL_MS);
      return photonCandidates;
    }
  }

  return [];
}
