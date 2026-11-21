import { z } from 'zod';
import { ARTICLE_CATEGORIES, COVER_FIT_MODES } from '../models/Article';

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter'),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .optional(),
  category: z.enum(ARTICLE_CATEGORIES),
  summary: z.string().trim().min(1, 'Ringkasan wajib diisi'),
  content: z.string().trim().min(1, 'Isi konten wajib diisi'),
  coverImageUrl: z.string().trim().max(5_000_000).optional(),
  coverFit: z.enum(COVER_FIT_MODES).optional(),
  coverPosition: z.string().trim().max(40).optional(),
  coverZoom: z.number().min(1).max(3).optional(),
  isPublished: z.boolean().optional(),
  authorName: z.string().trim().min(2).max(120).optional(),
});

export const updateArticleSchema = z
  .object({
    title: z.string().trim().min(3).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    category: z.enum(ARTICLE_CATEGORIES).optional(),
    summary: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    coverImageUrl: z.string().trim().max(5_000_000).optional(),
    coverFit: z.enum(COVER_FIT_MODES).optional(),
    coverPosition: z.string().trim().max(40).optional(),
    coverZoom: z.number().min(1).max(3).optional(),
    isPublished: z.boolean().optional(),
    authorName: z.string().trim().min(2).max(120).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu kolom harus diisi untuk pembaruan.',
  });

export const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
