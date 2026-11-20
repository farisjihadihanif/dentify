import { z } from 'zod';
import { CAPTURE_SOURCES } from '../constants/domain';

export const createScanBodySchema = z.object({
  capture_source: z.enum(CAPTURE_SOURCES, {
    errorMap: () => ({ message: 'Sumber foto harus bernilai camera atau upload.' }),
  }),
  user_symptoms: z
    .string()
    .trim()
    .max(500, 'Keluhan maksimal 500 karakter.')
    .optional()
    .default(''),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
