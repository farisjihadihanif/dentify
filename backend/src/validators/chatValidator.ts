import { z } from 'zod';

export const chatMessageSchema = z.object({
  session_id: z.string().trim().min(1).optional(),
  scan_id: z.string().trim().min(1).optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Pesan tidak boleh kosong.')
    .max(1000, 'Pesan maksimal 1000 karakter.'),
  image_base64: z.string().max(7_200_000, 'Ukuran lampiran foto maksimal 5 MB.').optional(),
  image_mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(10, 'Riwayat pesan tamu maksimal 10 pesan.')
    .optional()
    .default([]),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
