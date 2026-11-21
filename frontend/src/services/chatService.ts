/**
 * Deni conversational assistant service.
 */

import apiClient from './apiClient';
import type { UrgencyLevel } from '../components/StatusBadge';
import type { PaginationMeta } from './scanService';

export interface GuestHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface SendChatMessageInput {
  message: string;
  sessionId?: string | null;
  scanId?: string | null;
  history?: GuestHistoryItem[];
  imageBase64?: string | null;
  imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | null;
}

export interface ChatTurnResponseData {
  session_id: string | null;
  reply: string;
  urgency_level: UrgencyLevel;
  trigger_clinic_finder: boolean;
  suggested_questions: string[];
  is_fallback?: boolean;
  medical_disclaimer: string;
}

export interface SendChatResponsePayload {
  success: true;
  data: ChatTurnResponseData;
}

export interface ChatMessageItem {
  role: 'user' | 'assistant';
  content: string;
  urgency_level?: UrgencyLevel;
  trigger_clinic_finder: boolean;
  is_fallback?: boolean;
  attached_image_url?: string | null;
  timestamp: string;
}

export interface ChatSessionSummary {
  id: string;
  scan_id: string | null;
  title: string;
  has_triggered_clinic: boolean;
  updated_at: string;
}

export interface ChatSessionDetail {
  id: string;
  scan_id: string | null;
  title: string;
  has_triggered_clinic: boolean;
  messages: ChatMessageItem[];
  updated_at: string;
}

export interface ListChatSessionsResponsePayload {
  success: true;
  data: ChatSessionSummary[];
  meta: PaginationMeta;
}

export interface GetChatSessionDetailResponsePayload {
  success: true;
  data: ChatSessionDetail;
}

export interface DeleteChatSessionResponsePayload {
  success: true;
  message: string;
}

export const INITIAL_SUGGESTED_QUESTIONS: readonly string[] = [
  'Bagaimana langkah perawatan harian untuk kondisi gigi saya?',
  'Makanan atau minuman apa yang sebaiknya saya hindari sementara waktu?',
  'Kapan saya perlu segera memeriksakan diri ke dokter gigi?',
];

export async function sendDeniMessage(
  input: SendChatMessageInput,
): Promise<ChatTurnResponseData> {
  const body: Record<string, unknown> = {
    message: input.message.trim(),
  };
  if (input.sessionId) body.session_id = input.sessionId;
  if (input.scanId) body.scan_id = input.scanId;
  if (input.imageBase64) {
    body.image_data_url = input.imageBase64;
    body.image_base64 = input.imageBase64;
  }
  if (input.imageMimeType) body.image_mime_type = input.imageMimeType;
  if (input.history && input.history.length > 0) {
    body.history = input.history.slice(-10);
  }

  const { data } = await apiClient.post<SendChatResponsePayload>('/chat', body);
  return data.data;
}

export async function fetchChatSessions(
  page: number = 1,
  limit: number = 10,
): Promise<ListChatSessionsResponsePayload> {
  const { data } = await apiClient.get<ListChatSessionsResponsePayload>('/chat/sessions', {
    params: { page, limit },
  });
  return data;
}

export async function fetchChatSessionDetail(sessionId: string): Promise<ChatSessionDetail> {
  const { data } = await apiClient.get<GetChatSessionDetailResponsePayload>(
    `/chat/sessions/${encodeURIComponent(sessionId)}`,
  );
  return data.data;
}

export async function deleteChatSessionById(
  sessionId: string,
): Promise<DeleteChatSessionResponsePayload> {
  const { data } = await apiClient.delete<DeleteChatSessionResponsePayload>(
    `/chat/sessions/${encodeURIComponent(sessionId)}`,
  );
  return data;
}
