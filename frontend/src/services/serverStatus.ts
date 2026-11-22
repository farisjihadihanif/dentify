/**
 * Cold-start helpers for the free-tier backend and ai-service, which sleep after ~15 minutes
 * without traffic and need about a minute to wake up.
 */

import { resolveApiBaseUrl } from './apiClient';

export type ServerStatus = 'ready' | 'waking';

export const SERVER_WAKE_EXPECTED_SECONDS = 60;

const WARMUP_STORAGE_KEY = 'dentify_server_warmup_at';
const WARMUP_INTERVAL_MS = 10 * 60 * 1000;

interface HealthPayload {
  data?: {
    database?: string;
    ai_service?: { status?: string };
  };
}

/**
 * `ready` once the backend answers, MongoDB is connected and the ai-service has its model loaded.
 * Anything else (timeout, network error, 5xx, ai-service still starting) counts as `waking`.
 * The backend's /health also calls the ai-service, so polling it wakes both services.
 */
export async function checkServerStatus(
  baseUrl: string = resolveApiBaseUrl(),
  timeoutMs = 10000,
  fetchImpl: typeof fetch = fetch,
): Promise<ServerStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return 'waking';
    const body = (await res.json()) as HealthPayload;
    const ready = body.data?.database === 'connected' && body.data?.ai_service?.status === 'ok';
    return ready ? 'ready' : 'waking';
  } catch {
    return 'waking';
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire-and-forget ping on page load so the servers start waking while the user is still reading
 * the page. At most once per 10 minutes per tab.
 */
export function warmUpServers(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(WARMUP_STORAGE_KEY) ?? 0);
    if (Number.isFinite(last) && now - last < WARMUP_INTERVAL_MS) return false;
    window.sessionStorage.setItem(WARMUP_STORAGE_KEY, String(now));
  } catch {
    // Storage blocked (private mode): still warm up, just without throttling
  }
  void checkServerStatus(resolveApiBaseUrl(), 70000);
  return true;
}
