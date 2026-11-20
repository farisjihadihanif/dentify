/**
 * Single source of truth for storing and reading the client JWT Bearer token
 * (AGENTS.md §8, TASK.md Final Decision #11).
 */

export const AUTH_TOKEN_STORAGE_KEY = 'denthub_auth_token';

let inMemoryAuthToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryAuthToken) return inMemoryAuthToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage access errors in restricted private-browsing contexts
    }
  }
}

export function clearAuthToken(): void {
  setAuthToken(null);
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}
