import { z } from 'zod';

const MAX_AVATAR_LENGTH = 700_000; // ~500 KB image data URI

export const registerSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.').max(100, 'Nama lengkap maksimal 100 karakter.').optional(),
    name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.').max(100, 'Nama lengkap maksimal 100 karakter.').optional(),
    email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
    password: z.string().min(8, 'Password minimal 8 karakter.').max(128, 'Password maksimal 128 karakter.'),
  })
  .superRefine((data, ctx) => {
    if (!data.full_name && !data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['full_name'],
        message: 'Nama lengkap wajib diisi.',
      });
    }
  })
  .transform((data) => ({
    full_name: (data.full_name ?? data.name) as string,
    email: data.email,
    password: data.password,
  }));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.').max(100, 'Nama lengkap maksimal 100 karakter.').optional(),
    name: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter.').max(100, 'Nama lengkap maksimal 100 karakter.').optional(),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Username minimal 3 karakter.')
      .max(30, 'Username maksimal 30 karakter.')
      .regex(/^[a-z0-9._-]+$/, 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, atau tanda hubung.')
      .optional(),
    avatar: z
      .string()
      .max(MAX_AVATAR_LENGTH, 'Ukuran foto profil maksimal sekitar 500 KB.')
      .refine(
        (val) =>
          val === '' ||
          /^https?:\/\/.+$/i.test(val) ||
          /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(val),
        'Avatar harus berupa URL gambar atau data URI gambar (JPEG/PNG/WEBP).',
      )
      .optional(),
    current_password: z.string().min(1, 'Kata sandi saat ini wajib diisi.').optional(),
    new_password: z
      .string()
      .min(8, 'Kata sandi baru minimal 8 karakter.')
      .max(128, 'Kata sandi baru maksimal 128 karakter.')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.new_password && !data.current_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['current_password'],
        message: 'Kata sandi saat ini wajib diisi untuk mengganti kata sandi.',
      });
    }
  })
  .transform((data) => ({
    full_name: data.full_name ?? data.name,
    username: data.username,
    avatar: data.avatar,
    current_password: data.current_password,
    new_password: data.new_password,
  }));

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
