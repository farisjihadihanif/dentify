/**
 * Centralized Axios HTTP client for Dentify frontend.
 */

import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from './authStorage';
import { mapApiError, type MappedUiError } from './errorMapper';

export { AUTH_TOKEN_STORAGE_KEY, clearAuthToken, getAuthToken, setAuthToken };

const DEFAULT_API_URL = 'http://localhost:5000/api/v1';
const DEFAULT_TIMEOUT_MS = 30000;

export function resolveApiBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return raw.replace(/\/+$/, '');
}

export function attachAuthInterceptor(
  config: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig {
  const token = getAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers.set('Accept', 'application/json');
  return config;
}

export interface ApiClientError extends Error {
  uiError: MappedUiError;
  status?: number;
}

export function createApiClient(baseURL: string = resolveApiBaseUrl()): AxiosInstance {
  const timeoutMs = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  const instance = axios.create({
    baseURL,
    timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
    },
  });

  instance.interceptors.request.use(attachAuthInterceptor);

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const uiError = mapApiError(error);
      if (uiError.code === 'UNAUTHENTICATED' && uiError.action === 'redirect_login') {
        clearAuthToken();
      }
      const enriched: ApiClientError = Object.assign(new Error(uiError.message), {
        name: 'ApiClientError',
        uiError,
        status: error?.response?.status,
      });
      return Promise.reject(enriched);
    },
  );

  return instance;
}

export const apiClient = createApiClient();

export default apiClient;
