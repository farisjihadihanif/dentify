import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  buildIndonesianGeocodeVariants,
  clearOsmCaches,
} from '../src/services/osmClinicService';

describe('T-203 Clinics OSM endpoints: validation, distance sort, fallback, geocode', () => {
  beforeEach(() => {
    clearOsmCaches();
    vi.restoreAllMocks();
  });

  it('returns 400 BAD_REQUEST on out-of-range coordinates or invalid radius', async () => {
    const app = createApp();
    const badLat = await request(app).get('/api/v1/clinics?lat=99&lng=110.39');
    expect(badLat.status).toBe(400);
    expect(badLat.body.code).toBe('BAD_REQUEST');

    const badLng = await request(app).get('/api/v1/clinics?lat=-7.78&lng=200');
    expect(badLng.status).toBe(400);
    expect(badLng.body.code).toBe('BAD_REQUEST');

    const badRadius = await request(app).get('/api/v1/clinics?lat=-7.78&lng=110.39&radius_km=50');
    expect(badRadius.status).toBe(400);
    expect(badRadius.body.code).toBe('BAD_REQUEST');
  });

  it('returns OSM dental clinics sorted ascending by Haversine distance_km', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          elements: [
            {
              type: 'node',
              id: 2,
              lat: -7.81,
              lon: 110.42,
              tags: { name: 'Klinik Gigi Jauh', 'addr:street': 'Jl. Jauh' },
            },
            {
              type: 'way',
              id: 1,
              center: { lat: -7.784, lon: 110.392 },
              tags: {
                name: 'Klinik Gigi Dekat',
                'addr:street': 'Jl. Adisucipto',
                'addr:housenumber': '45',
                phone: '+62-274-555123',
              },
            },
            {
              type: 'node',
              id: 3,
              lat: -7.79,
              lon: 110.395,
              tags: {},
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=-7.783&lng=110.391&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('openstreetmap');
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].name).toBe('Klinik Gigi Dekat');
    expect(res.body.data[0].osm_url).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(res.body.data[0].distance_km).toBeLessThanOrEqual(res.body.data[1].distance_km);
    expect(res.body.data[1].distance_km).toBeLessThanOrEqual(res.body.data[2].distance_km);
    expect(res.body.data[1].name).toBe('Klinik Gigi (tanpa nama)');
  });

  it('rotates to secondary Overpass mirror when the primary mirror fails', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Primary Overpass timeout'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              {
                type: 'node',
                id: 99,
                lat: -7.77,
                lon: 110.37,
                tags: { name: 'Klinik Mirror Cadangan' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=-7.77&lng=110.37&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('openstreetmap');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Klinik Mirror Cadangan');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to seeded Indonesian clinic & RSGM directory when all Overpass mirrors fail in Yogyakarta', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('AbortError: timeout'));

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=-7.783&lng=110.391&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('directory_fallback');
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].distance_km).toBeLessThanOrEqual(res.body.data[res.body.data.length - 1].distance_km);
    expect(res.body.fallback.osm_url).toBe('https://www.openstreetmap.org/#map=15/-7.783/110.391');
  });

  it('returns empty fallback with direct OSM URL when Overpass fails outside seeded Indonesian regions', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('AbortError: timeout'));

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=0&lng=0&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('fallback');
    expect(res.body.data).toEqual([]);
    expect(res.body.fallback.osm_url).toBe('https://www.openstreetmap.org/#map=15/0/0');
  });

  it('GET /clinics/geocode validates q and maps up to 5 Nominatim candidates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            display_name: 'Sleman, Daerah Istimewa Yogyakarta, Indonesia',
            lat: '-7.716',
            lon: '110.355',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const app = createApp();
    const badQ = await request(app).get('/api/v1/clinics/geocode?q=a');
    expect(badQ.status).toBe(400);

    const ok = await request(app).get('/api/v1/clinics/geocode?q=Sleman');
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.data).toEqual([
      {
        display_name: 'Sleman, Daerah Istimewa Yogyakarta, Indonesia',
        latitude: -7.716,
        longitude: 110.355,
      },
    ]);
  });

  it('normalizes Indonesian subdistrict queries and supports nationwide Photon fallback when Overpass fails', async () => {
    const variants = buildIndonesianGeocodeVariants('Kecamatan Coblong, Kota Bandung');
    expect(variants).toContain('Kecamatan Coblong, Kota Bandung');
    expect(variants).toContain('Coblong, Bandung');
    expect(variants).toContain('Bandung');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('photon.komoot.io')) {
        return new Response(
          JSON.stringify({
            features: [
              {
                geometry: { coordinates: [116.842, -1.272] },
                properties: {
                  osm_type: 'N',
                  osm_id: 777,
                  name: 'Klinik Gigi Balikpapan Selatan',
                  city: 'Balikpapan',
                  state: 'Kalimantan Timur',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('Overpass busy');
    });

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=-1.27&lng=116.84&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('openstreetmap');
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBe('Klinik Gigi Balikpapan Selatan');
    expect(res.body.data[0].osm_url).toContain(
      'https://www.google.com/maps/dir/?api=1&destination=',
    );
  });
});
