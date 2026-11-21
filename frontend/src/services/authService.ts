/**
 * Frontend authentication service.
 */

import apiClient from './apiClient';
import { clearAuthToken, getAuthToken, setAuthToken } from './authStorage';

export const AUTH_USER_STORAGE_KEY = 'denthub_auth_user';

export interface AuthUser {
  id: string;
  full_name: string;
  username: string | null;
  avatar: string;
  email: string;
  role: 'user' | 'admin';
}

export interface UpdateProfileInput {
  full_name?: string;
  name?: string;
  username?: string;
  avatar?: string;
  current_password?: string;
  new_password?: string;
  /** Legacy camelCase aliases accepted from callers and mapped to snake_case */
  currentPassword?: string;
  newPassword?: string;
}

export interface AuthSessionData {
  token: string;
  user: AuthUser;
}

export interface AuthResponsePayload {
  success: true;
  data: AuthSessionData;
}

export interface MeResponsePayload {
  success: true;
  data: {
    user: AuthUser;
  };
}

export interface UpdateProfileResponsePayload {
  success: true;
  message: string;
  data: {
    user: AuthUser;
  };
}

export interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

let inMemoryUser: AuthUser | null = null;

export function getStoredUser(): AuthUser | null {
  if (inMemoryUser) return inMemoryUser;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredSession(token: string, user: AuthUser): void {
  setAuthToken(token);
  inMemoryUser = user;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
}

export function clearStoredSession(): void {
  clearAuthToken();
  inMemoryUser = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export async function registerUser(input: RegisterInput): Promise<AuthSessionData> {
  const payload: RegisterInput = {
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
  const { data } = await apiClient.post<AuthResponsePayload>('/auth/register', payload);
  setStoredSession(data.data.token, data.data.user);
  return data.data;
}

export async function loginUser(input: LoginInput): Promise<AuthSessionData> {
  const payload: LoginInput = {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  };
  const { data } = await apiClient.post<AuthResponsePayload>('/auth/login', payload);
  setStoredSession(data.data.token, data.data.user);
  return data.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<MeResponsePayload>('/auth/me');
  const user = data.data.user;
  inMemoryUser = user;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  }
  return user;
}

export async function updateCurrentUserProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const body: Record<string, string> = {};
  const resolvedName = input.full_name ?? input.name;
  if (resolvedName !== undefined) body.full_name = resolvedName;
  if (input.username !== undefined) body.username = input.username;
  if (input.avatar !== undefined) body.avatar = input.avatar;
  const currentPw = input.current_password ?? input.currentPassword;
  const newPw = input.new_password ?? input.newPassword;
  if (currentPw !== undefined) body.current_password = currentPw;
  if (newPw !== undefined) body.new_password = newPw;

  const { data } = await apiClient.put<UpdateProfileResponsePayload>('/auth/me', body);
  const user = data.data.user;
  inMemoryUser = user;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Ignore
    }
  }
  return user;
}
