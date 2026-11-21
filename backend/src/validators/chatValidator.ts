import { z } from 'zod';

export const chatMessageSchema = z
  .object({
    session_id: z.string().trim().min(1).optional(),
    scan_id: z.string().trim().min(1).optional(),
    message: z
      .string()
      .trim()
      .max(1000, 'Pesan maksimal 1000 karakter.')
      .optional()
      .default(''),
    image_data_url: z.string().max(7_200_000, 'Ukuran lampiran foto maksimal 5 MB.').optional(),
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
  })
  .refine(
    (data) =>
      data.message.trim().length > 0 ||
      Boolean(data.image_data_url?.trim() || data.image_base64?.trim()),
    {
      message: 'Pesan atau lampiran foto gigi tidak boleh kosong.',
      path: ['message'],
    },
  );

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
