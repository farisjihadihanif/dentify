import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import { geocodePlace, searchNearbyClinics } from '../services/osmClinicService';
import type { ClinicsQuery, GeocodeQuery } from '../validators/clinicValidator';

export async function getNearbyClinics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.validatedQuery as ClinicsQuery;
    const result = await searchNearbyClinics(query.lat, query.lng, query.radius_km);

    res.status(200).json({
      success: true,
      source: result.source,
      data: result.data,
      ...(result.fallback ? { fallback: result.fallback } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function getGeocode(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.validatedQuery as GeocodeQuery;
    const candidates = await geocodePlace(query.q);

    res.status(200).json({
      success: true,
      data: candidates,
    });
  } catch (err) {
    next(err);
  }
}
