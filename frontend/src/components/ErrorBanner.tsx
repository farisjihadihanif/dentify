'use client';

import React from 'react';
import { isServerWakingError, mapApiError, type MappedUiError } from '../services/errorMapper';
import { AppButton } from './AppButton';
import { ServerWakingNotice } from './ServerWakingNotice';

export interface ErrorBannerProps {
  error: MappedUiError | unknown;
  onRetry?: () => void;
  onDismiss?: () => void;
  onSwitchToManualLocation?: () => void;
  className?: string;
}

/**
 * Komponen banner galat standar.
 * Menerima `MappedUiError` atau objek galat mentah, lalu menampilkan pesan Bahasa Indonesia
 * beserta tombol aksi kontekstual (`Coba Lagi`, `Input Lokasi Manual`, atau detail validasi per field).
 */
export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
  onSwitchToManualLocation,
  className = '',
}: ErrorBannerProps) {
  if (!error) return null;

  const uiError: MappedUiError =
    typeof error === 'object' && error !== null && 'action' in error && 'code' in error
      ? (error as MappedUiError)
      : mapApiError(error);

  // Free-tier cold start: a calm waiting state with retry instead of a red error
  if (isServerWakingError(uiError)) {
    return <ServerWakingNotice onRetry={onRetry} onDismiss={onDismiss} className={className} />;
  }

  const fieldEntries = uiError.fieldErrors ? Object.entries(uiError.fieldErrors) : [];

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-error-code={uiError.code}
      className={[
        'rounded-card border border-status-red bg-surface p-4 text-text shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-status-red text-badge font-bold text-surface"
          >
            !
          </span>
          <div>
            {uiError.title && <p className="font-bold text-status-red">{uiError.title}</p>}
            <p className={uiError.title ? 'mt-0.5 text-sm text-text' : 'font-semibold text-status-red'}>
              {uiError.message}
            </p>
            {fieldEntries.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-badge text-text-muted">
                {fieldEntries.flatMap(([field, messages]) =>
                  messages.map((msg, idx) => <li key={`${field}-${idx}`}>{msg}</li>),
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {uiError.action === 'show_retry_button' && onRetry && (
            <AppButton variant="secondary" onClick={onRetry}>
              Coba Lagi
            </AppButton>
          )}
          {uiError.action === 'show_manual_location_form' && onSwitchToManualLocation && (
            <AppButton variant="secondary" onClick={onSwitchToManualLocation}>
              Ketik Kota Manual
            </AppButton>
          )}
          {onDismiss && (
            <AppButton variant="ghost" onClick={onDismiss} aria-label="Tutup pesan galat">
              Tutup
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorBanner;
