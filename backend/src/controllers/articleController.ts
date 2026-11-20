import type { NextFunction, Request, Response } from 'express';
import { Article, ARTICLE_CATEGORIES, serializeArticle, type ArticleCategory } from '../models/Article';
import { ApiError } from '../utils/ApiError';

export async function listPublishedArticles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categoryRaw = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const searchRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const filter: Record<string, unknown> = { isPublished: true };
    if (categoryRaw && (ARTICLE_CATEGORIES as readonly string[]).includes(categoryRaw)) {
      filter.category = categoryRaw as ArticleCategory;
    }
    if (searchRaw) {
      const escaped = searchRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ title: regex }, { summary: regex }];
    }

    const docs = await Article.find(filter).sort({ publishedAt: -1, created_at: -1 });
    res.status(200).json({
      success: true,
      data: docs.map(serializeArticle),
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublishedArticleBySlug(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const slug = String(req.params.slug ?? '').trim().toLowerCase();
    if (!slug) {
      next(new ApiError(404, 'NOT_FOUND', 'Artikel tidak ditemukan.'));
      return;
    }

    const doc = await Article.findOne({ slug, isPublished: true });
    if (!doc) {
      next(new ApiError(404, 'NOT_FOUND', 'Artikel tidak ditemukan atau belum dipublikasikan.'));
      return;
    }

    res.status(200).json({
      success: true,
      data: serializeArticle(doc),
    });
  } catch (err) {
    next(err);
  }
}
