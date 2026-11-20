import { z } from 'zod';

export const clinicsQuerySchema = z.object({
  lat: z.coerce
    .number({ invalid_type_error: 'Parameter lat harus berupa angka.' })
    .min(-90, 'Parameter lat harus berada di antara -90 dan 90.')
    .max(90, 'Parameter lat harus berada di antara -90 dan 90.'),
  lng: z.coerce
    .number({ invalid_type_error: 'Parameter lng harus berupa angka.' })
    .min(-180, 'Parameter lng harus berada di antara -180 dan 180.')
    .max(180, 'Parameter lng harus berada di antara -180 dan 180.'),
  radius_km: z.coerce
    .number({ invalid_type_error: 'Parameter radius_km harus berupa angka.' })
    .min(0.5, 'Radius minimal 0.5 km.')
    .max(20, 'Radius maksimal 20 km.')
    .default(5),
});

export const geocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Kata kunci lokasi minimal 2 karakter.')
    .max(100, 'Kata kunci lokasi maksimal 100 karakter.'),
});

export type ClinicsQuery = z.infer<typeof clinicsQuerySchema>;
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;
