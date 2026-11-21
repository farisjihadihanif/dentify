/**
 * Public News, Promo & Articles service (`/api/v1/articles`).
 */

import apiClient from './apiClient';

export const ARTICLE_CATEGORIES = ['Berita', 'Promo', 'Artikel'] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];
export type CoverFitMode = 'cover' | 'contain';

export interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl: string;
  coverFit?: CoverFitMode;
  coverPosition?: string;
  coverZoom?: number;
  isPublished: boolean;
  authorName: string;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArticleListResponsePayload {
  success: true;
  data: ArticleItem[];
}

export interface ArticleDetailResponsePayload {
  success: true;
  data: ArticleItem;
}

export async function fetchPublishedArticles(params?: {
  category?: ArticleCategory;
  q?: string;
}): Promise<ArticleItem[]> {
  const query: Record<string, string> = {};
  if (params?.category) query.category = params.category;
  if (params?.q && params.q.trim()) query.q = params.q.trim();

  const { data } = await apiClient.get<ArticleListResponsePayload>('/articles', {
    params: query,
  });
  return data.data;
}

export async function fetchArticleBySlug(slug: string): Promise<ArticleItem> {
  const { data } = await apiClient.get<ArticleDetailResponsePayload>(
    `/articles/${encodeURIComponent(slug)}`,
  );
  return data.data;
}

/**
 * Dynamically reorders the 3 category shelves on `/berita` so the selected category
 * always moves to the very top right beneath Section 1's search & filter bar.
 */
export function getOrderedCategories(selected: ArticleCategory): ArticleCategory[] {
  return [selected, ...ARTICLE_CATEGORIES.filter((cat) => cat !== selected)];
}
