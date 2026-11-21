import { getEnv } from '../config/env';
import type { DentalCondition, UrgencyLevel } from '../constants/domain';
import type { IDetection } from '../models';
import { ApiError } from '../utils/ApiError';

export interface AiPredictResponse {
  primary_condition: DentalCondition;
  confidence_score: number;
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
  image_base64?: string;
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

export async function requestDentalPrediction(params: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  userSymptoms?: string;
}): Promise<AiPredictResponse> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiServiceTimeoutMs);

  try {
    const form = new FormData();
    const uint8 = new Uint8Array(params.buffer);
    const blob = new Blob([uint8], { type: params.mimeType });
    form.append('image', blob, params.filename || 'scan.jpg');
    if (params.userSymptoms) {
      form.append('user_symptoms', params.userSymptoms);
    }

    const response = await fetch(`${env.aiServiceUrl}/internal/predict`, {
      method: 'POST',
      headers: {
        'X-Internal-Key': env.aiServiceApiKey,
        Accept: 'application/json',
      },
      body: form,
      signal: controller.signal,
    });

    if (response.status === 422) {
      let detail: { code?: string; message?: string; detail?: { code?: string; message?: string } } =
        {};
      try {
        detail = (await response.json()) as typeof detail;
      } catch {
        // fallback below
      }
      const code = detail.code ?? detail.detail?.code;
      const message =
        detail.message ??
        detail.detail?.message ??
        'Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.';

      if (code === 'INVALID_IMAGE') {
        throw new ApiError(422, 'INVALID_IMAGE', message);
      }
      throw new ApiError(422, 'LOW_QUALITY_IMAGE', message);
    }

    if (!response.ok) {
      throw new ApiError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        'Layanan analisis AI sedang sibuk. Silakan kirim ulang foto Anda.',
      );
    }

    return (await response.json()) as AiPredictResponse;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      502,
      'AI_SERVICE_UNAVAILABLE',
      'Layanan analisis AI sedang tidak dapat dihubungi. Silakan coba lagi beberapa saat.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAgentChat(payload: AiAgentChatRequest): Promise<AiAgentChatResponse> {
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiServiceTimeoutMs);

  try {
    const response = await fetch(`${env.aiServiceUrl}/internal/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.aiServiceApiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        'Layanan asisten Deni sedang mengalami kendala sementara.',
      );
    }

    return (await response.json()) as AiAgentChatResponse;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(
      502,
      'AI_SERVICE_UNAVAILABLE',
      'Layanan asisten Deni sedang tidak dapat dihubungi.',
    );
  } finally {
    clearTimeout(timer);
  }
}
