import { z } from 'zod';

export const chatMessageSchema = z.object({
  session_id: z.string().trim().min(1).optional(),
  scan_id: z.string().trim().min(1).optional(),
  message: z
    .string()
    .trim()
    .min(1, 'Pesan tidak boleh kosong.')
    .max(1000, 'Pesan maksimal 1000 karakter.'),
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
