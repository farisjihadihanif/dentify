/**
 * Admin CMS & User Management service (`/api/v1/admin/*`).
 */

import apiClient from './apiClient';
import type { ArticleCategory, ArticleItem, CoverFitMode } from './articleService';
import type { AuthUser } from './authService';

export interface CreateArticlePayload {
  title: string;
  slug?: string;
  category: ArticleCategory;
  summary: string;
  content: string;
  coverImageUrl?: string;
  coverFit?: CoverFitMode;
  coverPosition?: string;
  coverZoom?: number;
  isPublished?: boolean;
  authorName?: string;
}

export type UpdateArticlePayload = Partial<CreateArticlePayload>;

export interface AdminArticlesResponse {
  success: true;
  data: ArticleItem[];
}

export interface AdminArticleMutationResponse {
  success: true;
  message: string;
  data: ArticleItem;
}

export interface AdminUsersResponse {
  success: true;
  data: AuthUser[];
}

export interface AdminUserMutationResponse {
  success: true;
  message: string;
  data: AuthUser;
}

export interface AdminDeleteResponse {
  success: true;
  message: string;
}

export async function adminFetchArticles(): Promise<ArticleItem[]> {
  const { data } = await apiClient.get<AdminArticlesResponse>('/admin/articles');
  return data.data;
}

export async function adminCreateArticle(payload: CreateArticlePayload): Promise<ArticleItem> {
  const { data } = await apiClient.post<AdminArticleMutationResponse>('/admin/articles', payload);
  return data.data;
}

export async function adminUpdateArticle(
  id: string,
  payload: UpdateArticlePayload,
): Promise<ArticleItem> {
  const { data } = await apiClient.patch<AdminArticleMutationResponse>(
    `/admin/articles/${encodeURIComponent(id)}`,
    payload,
  );
  return data.data;
}

export async function adminDeleteArticle(id: string): Promise<string> {
  const { data } = await apiClient.delete<AdminDeleteResponse>(
    `/admin/articles/${encodeURIComponent(id)}`,
  );
  return data.message;
}

export async function adminFetchUsers(q?: string): Promise<AuthUser[]> {
  const params = q && q.trim() ? { q: q.trim() } : undefined;
  const { data } = await apiClient.get<AdminUsersResponse>('/admin/users', { params });
  return data.data;
}

export async function adminUpdateUserRole(
  id: string,
  role: 'user' | 'admin',
): Promise<AuthUser> {
  const { data } = await apiClient.patch<AdminUserMutationResponse>(
    `/admin/users/${encodeURIComponent(id)}`,
    { role },
  );
  return data.data;
}

export async function adminDeleteUser(id: string): Promise<string> {
  const { data } = await apiClient.delete<AdminDeleteResponse>(
    `/admin/users/${encodeURIComponent(id)}`,
  );
  return data.message;
}
