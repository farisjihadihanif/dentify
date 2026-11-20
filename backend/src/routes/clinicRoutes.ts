import { Router } from 'express';
import { getGeocode, getNearbyClinics } from '../controllers/clinicController';
import { clinicsRateLimiter } from '../middlewares/rateLimiter';
import { validateQuery } from '../middlewares/validate';
import { clinicsQuerySchema, geocodeQuerySchema } from '../validators/clinicValidator';

const router = Router();

router.get(
  '/',
  clinicsRateLimiter,
  validateQuery(clinicsQuerySchema, { statusCode: 400 }),
  getNearbyClinics,
);
router.get(
  '/geocode',
  clinicsRateLimiter,
  validateQuery(geocodeQuerySchema, { statusCode: 400 }),
  getGeocode,
);

export default router;
