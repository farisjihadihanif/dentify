/**
 * AI-output user feedback service (POST /api/v1/feedback - docs/API_SPECS.md §6.2, DESIGN.md §8.3).
 */

import apiClient from './apiClient';

export type FeedbackTargetType = 'scan' | 'chat_message';
export type FeedbackRating = 'helpful' | 'inaccurate';

export interface SubmitFeedbackInput {
  target_type: FeedbackTargetType;
  target_id: string;
  rating: FeedbackRating;
  comment?: string;
}

export interface FeedbackRecord {
  id: string;
  target_type: FeedbackTargetType;
  target_id: string;
  rating: FeedbackRating;
  comment: string;
  created_at: string;
}

export interface SubmitFeedbackResponse {
  success: true;
  message: string;
  data: FeedbackRecord;
}

export async function submitAiFeedback(input: SubmitFeedbackInput): Promise<FeedbackRecord> {
  const payload: SubmitFeedbackInput = {
    target_type: input.target_type,
    target_id: input.target_id,
    rating: input.rating,
    ...(input.comment?.trim() ? { comment: input.comment.trim().slice(0, 300) } : {}),
  };
  const { data } = await apiClient.post<SubmitFeedbackResponse>('/feedback', payload);
  return data.data;
}
