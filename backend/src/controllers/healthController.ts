import type { Request, Response } from 'express';
import { getDbStatus } from '../config/db';
import { getEnv } from '../config/env';

interface AiHealthResponse {
  status: string;
  model_version: string | null;
  model_loaded: boolean;
}

async function fetchAiServiceHealth(): Promise<{
  status: 'ok' | 'degraded' | 'unavailable';
  model_version: string | null;
  model_loaded: boolean;
}> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${env.aiServiceUrl}/internal/health`, {
      method: 'GET',
      headers: {
        'X-Internal-Key': env.aiServiceApiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: 'unavailable', model_version: null, model_loaded: false };
    }
    const data = (await response.json()) as Partial<AiHealthResponse>;
    return {
      status: data.model_loaded ? 'ok' : 'degraded',
      model_version: data.model_version ?? null,
      model_loaded: Boolean(data.model_loaded),
    };
  } catch {
    return { status: 'unavailable', model_version: null, model_loaded: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const dbStatus = getDbStatus();
  const aiStatus =
    process.env.NODE_ENV === 'test' && process.env.SKIP_AI_HEALTH_IN_TEST !== 'false'
      ? { status: 'unavailable' as const, model_version: null, model_loaded: false }
      : await fetchAiServiceHealth();

  res.status(200).json({
    success: true,
    data: {
      service: 'dentify-backend',
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      database: dbStatus,
      ai_service: aiStatus,
      timestamp: new Date().toISOString(),
    },
  });
}
