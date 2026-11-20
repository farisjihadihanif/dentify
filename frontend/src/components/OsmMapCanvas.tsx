'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { ClinicItem } from '../services/clinicService';

export interface OsmMapCanvasProps {
  centerLat: number;
  centerLng: number;
  clinics: ClinicItem[];
  radiusKm?: number;
}

/**
 * Komponen internal peta Leaflet + OpenStreetMap tiles (hanya dijalankan di browser melalui
 * `dynamic(..., { ssr: false })` pada `OsmMapView.tsx` sesuai `DESIGN.md §7`).
 */
export default function OsmMapCanvas({
  centerLat,
  centerLng,
  clinics,
  radiusKm = 5,
}: OsmMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined') return undefined;

    let isCancelled = false;
    let mapInstance: import('leaflet').Map | null = null;

    void import('leaflet').then((leafletModule) => {
      if (isCancelled || !containerRef.current) return;
      const L = leafletModule.default || leafletModule;

      mapInstance = L.map(containerRef.current).setView([centerLat, centerLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstance);

      // Pin lokasi pengguna + lingkaran radius pencarian
      L.circleMarker([centerLat, centerLng], {
        radius: 9,
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      })
        .addTo(mapInstance)
        .bindPopup('<strong>Lokasi Anda Saat Ini</strong>');

      L.circle([centerLat, centerLng], {
        radius: radiusKm * 1000,
        weight: 1,
        fillOpacity: 0.08,
      }).addTo(mapInstance);

      // Pin untuk setiap klinik gigi terdekat
      for (const clinic of clinics) {
        L.circleMarker([clinic.latitude, clinic.longitude], {
          radius: 8,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        })
          .addTo(mapInstance)
          .bindPopup(
            `<strong>${clinic.name}</strong><br/>${clinic.address}<br/>Jarak: ${clinic.distance_km.toFixed(
              1,
            )} km`,
          );
      }
    });

    return () => {
      isCancelled = true;
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
    };
  }, [centerLat, centerLng, clinics, radiusKm]);

  return (
    <div
      ref={containerRef}
      aria-label="Kanvas Peta Interaktif OpenStreetMap"
      className="h-72 w-full rounded-card sm:h-96"
    />
  );
}
