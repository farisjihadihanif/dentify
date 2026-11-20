import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { clearOsmCaches } from '../src/services/osmClinicService';

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
    expect(res.body.data[0].distance_km).toBeLessThanOrEqual(res.body.data[1].distance_km);
    expect(res.body.data[1].distance_km).toBeLessThanOrEqual(res.body.data[2].distance_km);
    expect(res.body.data[1].name).toBe('Klinik Gigi (tanpa nama)');
  });

  it('returns 200 fallback object with direct OSM URL when Overpass times out or fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('AbortError: timeout'));

    const app = createApp();
    const res = await request(app).get('/api/v1/clinics?lat=-7.783&lng=110.391&radius_km=5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.source).toBe('fallback');
    expect(res.body.data).toEqual([]);
    expect(res.body.fallback.osm_url).toBe('https://www.openstreetmap.org/#map=15/-7.783/110.391');
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
});
