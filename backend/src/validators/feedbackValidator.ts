import { z } from 'zod';
import { FEEDBACK_RATINGS, FEEDBACK_TARGET_TYPES } from '../models/Feedback';

export const createFeedbackSchema = z.object({
  target_type: z.enum(FEEDBACK_TARGET_TYPES, {
    errorMap: () => ({ message: 'target_type harus bernilai scan atau chat_message.' }),
  }),
  target_id: z
    .string()
    .trim()
    .min(1, 'target_id wajib diisi.')
    .max(120, 'target_id maksimal 120 karakter.'),
  rating: z.enum(FEEDBACK_RATINGS, {
    errorMap: () => ({ message: 'rating harus bernilai helpful atau inaccurate.' }),
  }),
  comment: z
    .string()
    .trim()
    .max(300, 'Komentar maksimal 300 karakter.')
    .optional()
    .default(''),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
