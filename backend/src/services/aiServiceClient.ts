import { getEnv } from '../config/env';
import type { DentalCondition, UrgencyLevel } from '../constants/domain';
import type { IDetection } from '../models';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export interface AiPredictResponse {
  primary_condition: DentalCondition;
  confidence_score: number;
  is_low_confidence?: boolean;
  probabilities: Record<DentalCondition, number>;
  detections: IDetection[];
  urgency_level: UrgencyLevel;
  trigger_clinic_finder: boolean;
  quality: {
    blur_score: number;
    mean_luminance: number;
    passed: boolean;
  };
  model_version: string;
}

export interface AiChatKnowledgeItem {
  condition_key: string;
  title: string;
  description: string;
  dos: string[];
  donts: string[];
  emergency_signs: string[];
}

export interface AiAgentChatRequest {
  message: string;
  user_name?: string;
  image_data_url?: string;
  image_mime_type?: string;
  scan_context?: {
    primary_condition: DentalCondition;
    confidence_score: number;
    urgency_level: UrgencyLevel;
    user_symptoms: string;
  };
  chat_history: Array<{ role: 'user' | 'assistant'; content: string }>;
  knowledge_context: AiChatKnowledgeItem[];
}

export interface AiAgentChatResponse {
  reply: string;
  urgency_level: UrgencyLevel;
  trigger_clinic_finder: boolean;
  suggested_questions: string[];
}

type AiOperation = 'predict' | 'agent_chat';

interface AiRawResponse {
  status: number;
  text: string;
}

function unavailableError(): ApiError {
  return new ApiError(
    502,
    'AI_SERVICE_UNAVAILABLE',
    'Layanan AI sedang dinyalakan atau tidak dapat dihubungi. Silakan coba lagi sebentar lagi.',
  );
}

/**
 * Sends one request to the ai-service and logs its status and duration (never the key, body or
 * photo). Network failures and timeouts become AI_SERVICE_UNAVAILABLE.
 */
async function callAiService(
  operation: AiOperation,
  path: string,
  init: { headers?: Record<string, string>; body: FormData | string },
): Promise<AiRawResponse> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiServiceTimeoutMs);
  const startedAt = Date.now();
  let status: number | 'timeout' | 'network_error' = 'network_error';

  try {
    const response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: {
        ...init.headers,
        'X-Internal-Key': env.aiServiceApiKey,
        Accept: 'application/json',
      },
      body: init.body,
      signal: controller.signal,
    });
    const text = await response.text();
    status = response.status;
    return { status: response.status, text };
  } catch {
    if (controller.signal.aborted) status = 'timeout';
    throw unavailableError();
  } finally {
    clearTimeout(timer);
    const ok = typeof status === 'number' && status < 400;
    logger[ok ? 'info' : 'warn']('AI service call', {
      operation,
      status,
      duration_ms: Date.now() - startedAt,
    });
  }
}

/** Only 502/503/504 mean "still waking up"; every other failure is a real error worth showing. */
function parseAiResponse<T>(response: AiRawResponse): T {
  const { status, text } = response;
  if (status === 502 || status === 503 || status === 504) {
    throw unavailableError();
  }
  if (status === 401 || status === 403) {
    throw new ApiError(
      502,
      'AI_AUTH_FAILED',
      `Layanan AI menolak kunci akses server (HTTP ${status}). Hubungi pengelola Dentify.`,
    );
  }
  if (status < 200 || status >= 300) {
    throw new ApiError(
      502,
      'AI_SERVICE_ERROR',
      `Layanan AI gagal memproses permintaan (HTTP ${status}). Silakan coba lagi.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      502,
      'AI_SERVICE_ERROR',
      `Layanan AI mengirim jawaban yang tidak dapat dibaca (HTTP ${status}). Silakan coba lagi.`,
    );
  }
}

function throwImageError(text: string): never {
  let detail: { code?: string; message?: string; detail?: { code?: string; message?: string } } = {};
  try {
    detail = JSON.parse(text) as typeof detail;
  } catch {
    // fallback below
  }
  const code = detail.code ?? detail.detail?.code;
  const message =
    detail.message ??
    detail.detail?.message ??
    'Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.';

  if (code === 'NOT_DENTAL_IMAGE') {
    throw new ApiError(
      422,
      'NOT_DENTAL_IMAGE',
      'Foto yang diunggah bukan foto gigi atau rongga mulut. Unggah foto gigi yang terlihat jelas untuk memulai pemindaian.',
    );
  }
  if (code === 'INVALID_IMAGE') {
    throw new ApiError(422, 'INVALID_IMAGE', message);
  }
  if (code === 'LOW_CONFIDENCE') {
    throw new ApiError(
      502,
      'AI_SERVICE_ERROR',
      'Layanan analisis AI perlu menyegarkan prediksi (HTTP 422). Silakan coba kirim ulang foto Anda.',
    );
  }
  throw new ApiError(422, 'LOW_QUALITY_IMAGE', message);
}

export async function requestDentalPrediction(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  userSymptoms?: string;
}): Promise<AiPredictResponse> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(params.buffer)], { type: params.mimeType });
  form.append('image', blob, params.filename || 'scan.jpg');
  if (params.userSymptoms) {
    form.append('user_symptoms', params.userSymptoms);
  }

  const response = await callAiService('predict', '/internal/predict', { body: form });
  if (response.status === 422) throwImageError(response.text);
  return parseAiResponse<AiPredictResponse>(response);
}

export async function requestAgentChat(payload: AiAgentChatRequest): Promise<AiAgentChatResponse> {
  const response = await callAiService('agent_chat', '/internal/agent/chat', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseAiResponse<AiAgentChatResponse>(response);
}
