import { z } from 'zod';
import { ARTICLE_CATEGORIES } from '../models/Article';

export const createArticleSchema = z.object({
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(180, 'Judul maksimal 180 karakter'),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung')
    .optional(),
  category: z.enum(ARTICLE_CATEGORIES),
  summary: z
    .string()
    .trim()
    .min(10, 'Ringkasan minimal 10 karakter')
    .max(600, 'Ringkasan maksimal 600 karakter'),
  content: z
    .string()
    .trim()
    .min(20, 'Isi artikel minimal 20 karakter')
    .max(25000, 'Isi artikel terlalu panjang'),
  coverImageUrl: z.string().trim().max(2_000_000).optional(),
  isPublished: z.boolean().optional(),
  authorName: z.string().trim().min(2).max(120).optional(),
});

export const updateArticleSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    category: z.enum(ARTICLE_CATEGORIES).optional(),
    summary: z.string().trim().min(10).max(600).optional(),
    content: z.string().trim().min(20).max(25000).optional(),
    coverImageUrl: z.string().trim().max(2_000_000).optional(),
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
