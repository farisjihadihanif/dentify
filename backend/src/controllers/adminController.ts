import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import { Article, serializeArticle, User, serializeUser } from '../models';
import { ApiError } from '../utils/ApiError';
import type {
  CreateArticleInput,
  UpdateArticleInput,
  UpdateUserRoleInput,
} from '../validators/articleValidator';

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
  return base || `artikel-${Date.now()}`;
}

async function generateUniqueSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugifyTitle(desired);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const query: Record<string, unknown> = { slug: candidate };
    if (excludeId && mongoose.isValidObjectId(excludeId)) {
      query._id = { $ne: excludeId };
    }
    const exists = await Article.exists(query);
    if (!exists) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function adminListArticles(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const docs = await Article.find().sort({ publishedAt: -1, created_at: -1 });
    res.status(200).json({
      success: true,
      data: docs.map(serializeArticle),
    });
  } catch (err) {
    next(err);
  }
}

export async function adminCreateArticle(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateArticleInput;
    const slug = await generateUniqueSlug(body.slug || body.title);
    const isPublished = body.isPublished ?? true;

    const doc = await Article.create({
      title: body.title,
      slug,
      category: body.category,
      summary: body.summary,
      content: body.content,
      coverImageUrl: body.coverImageUrl?.trim() || '/images/covers/artikel-default.svg',
      isPublished,
      authorName: body.authorName?.trim() || 'Admin DentHub',
      publishedAt: isPublished ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      message: 'Konten berhasil dibuat.',
      data: serializeArticle(doc),
    });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateArticle(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    if (!mongoose.isValidObjectId(id)) {
      next(new ApiError(404, 'NOT_FOUND', 'Konten tidak ditemukan.'));
      return;
    }

    const doc = await Article.findById(id);
    if (!doc) {
      next(new ApiError(404, 'NOT_FOUND', 'Konten tidak ditemukan.'));
      return;
    }

    const body = req.body as UpdateArticleInput;
    if (body.title !== undefined) doc.title = body.title;
    if (body.slug !== undefined) {
      doc.slug = await generateUniqueSlug(body.slug, id);
    }
    if (body.category !== undefined) doc.category = body.category;
    if (body.summary !== undefined) doc.summary = body.summary;
    if (body.content !== undefined) doc.content = body.content;
    if (body.coverImageUrl !== undefined) {
      doc.coverImageUrl = body.coverImageUrl.trim() || '/images/covers/artikel-default.svg';
    }
    if (body.authorName !== undefined) doc.authorName = body.authorName;
    if (body.isPublished !== undefined) {
      doc.isPublished = body.isPublished;
      if (body.isPublished && !doc.publishedAt) {
        doc.publishedAt = new Date();
      }
    }

    await doc.save();

    res.status(200).json({
      success: true,
      message: 'Konten berhasil diperbarui.',
      data: serializeArticle(doc),
    });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteArticle(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    if (!mongoose.isValidObjectId(id)) {
      next(new ApiError(404, 'NOT_FOUND', 'Konten tidak ditemukan.'));
      return;
    }

    const deleted = await Article.findByIdAndDelete(id);
    if (!deleted) {
      next(new ApiError(404, 'NOT_FOUND', 'Konten tidak ditemukan.'));
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Konten berhasil dihapus.',
    });
  } catch (err) {
    next(err);
  }
}

export async function adminListUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const searchRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter: Record<string, unknown> = {};
    if (searchRaw) {
      const escaped = searchRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ full_name: regex }, { email: regex }, { username: regex }];
    }

    const users = await User.find(filter).sort({ created_at: -1 });
    res.status(200).json({
      success: true,
      data: users.map(serializeUser),
    });
  } catch (err) {
    next(err);
  }
}

export async function adminUpdateUserRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    if (!mongoose.isValidObjectId(id)) {
      next(new ApiError(404, 'NOT_FOUND', 'Akun pengguna tidak ditemukan.'));
      return;
    }

    const body = req.body as UpdateUserRoleInput;
    const user = await User.findById(id);
    if (!user) {
      next(new ApiError(404, 'NOT_FOUND', 'Akun pengguna tidak ditemukan.'));
      return;
    }

    user.role = body.role;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Peran pengguna berhasil diperbarui.',
      data: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function adminDeleteUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    if (!mongoose.isValidObjectId(id)) {
      next(new ApiError(404, 'NOT_FOUND', 'Akun pengguna tidak ditemukan.'));
      return;
    }

    if (req.user && req.user.id === id) {
      next(
        new ApiError(
          400,
          'BAD_REQUEST',
          'Anda tidak dapat menghapus akun admin yang sedang aktif digunakan.',
        ),
      );
      return;
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      next(new ApiError(404, 'NOT_FOUND', 'Akun pengguna tidak ditemukan.'));
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Akun pengguna berhasil dihapus.',
    });
  } catch (err) {
    next(err);
  }
}
