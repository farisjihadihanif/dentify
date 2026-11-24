'use client';

import React, { useState, type FormEvent } from 'react';
import { CheckCircle2, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  submitAiFeedback,
  type FeedbackRating,
  type FeedbackTargetType,
} from '../services/feedbackService';

export interface AiFeedbackControlProps {
  targetType: FeedbackTargetType;
  targetId: string;
  compact?: boolean;
}

/**
 * Lightweight user feedback control on every scan result and Deni message.
 * Submits "Membantu" (`helpful`) / "Tidak akurat" (`inaccurate`) + optional comment (<= 300 chars)
 * to `POST /api/v1/feedback`.
 */
export function AiFeedbackControl({
  targetType,
  targetId,
  compact = false,
}: AiFeedbackControlProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSelectRating = (rating: FeedbackRating) => {
    setSelectedRating(rating);
    setErrorText(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRating || isSubmitting) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await submitAiFeedback({
        target_type: targetType,
        target_id: targetId,
        rating: selectedRating,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      setErrorText('Gagal mengirim masukan. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        data-testid="ai-feedback-submitted"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-status-green"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Terima kasih atas masukan Anda.</span>
      </div>
    );
  }

  return (
    <div
      data-testid="ai-feedback-control"
      className={compact ? 'mt-2 space-y-2 border-t border-border pt-2' : 'space-y-2.5 rounded-card border border-border bg-bg p-3.5'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="basis-full text-xs font-medium text-text-muted sm:basis-auto">Apakah hasil ini membantu?</span>
        <button
          type="button"
          onClick={() => handleSelectRating('helpful')}
          aria-pressed={selectedRating === 'helpful'}
          className={[
            'inline-flex h-9 min-h-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-xs font-semibold btn-motion',
            selectedRating === 'helpful'
              ? 'border-accent-deni bg-accent-deni text-surface'
              : 'border-border bg-surface text-text hover:bg-brand-soft',
          ].join(' ')}
        >
          <ThumbsUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Membantu</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectRating('inaccurate')}
          aria-pressed={selectedRating === 'inaccurate'}
          className={[
            'inline-flex h-9 min-h-touch items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-xs font-semibold btn-motion',
            selectedRating === 'inaccurate'
              ? 'border-status-red bg-status-red text-surface'
              : 'border-border bg-surface text-text hover:bg-brand-soft',
          ].join(' ')}
        >
          <ThumbsDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Tidak akurat</span>
        </button>
      </div>

      {selectedRating && (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`fb-comment-${targetType}-${targetId}`} className="sr-only">
            Komentar singkat opsional (maksimal 300 karakter)
          </label>
          <input
            id={`fb-comment-${targetType}-${targetId}`}
            type="text"
            maxLength={300}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tambahkan komentar singkat (opsional, maks. 300 karakter)..."
            className="h-10 min-h-touch flex-1 rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-10 min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand px-4 text-sm font-semibold text-surface btn-motion hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Mengirim...' : 'Kirim Masukan'}
          </button>
        </form>
      )}

      {errorText && (
        <p role="alert" className="text-xs font-medium text-status-red">
          {errorText}
        </p>
      )}
    </div>
  );
}

export default AiFeedbackControl;
