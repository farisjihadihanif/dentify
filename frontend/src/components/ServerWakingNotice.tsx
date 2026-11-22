'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  checkServerStatus,
  SERVER_WAKE_EXPECTED_SECONDS,
  type ServerStatus,
} from '../services/serverStatus';
import { AppButton } from './AppButton';

export interface ServerWakingNoticeProps {
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  /** Override for tests */
  checkStatus?: () => Promise<ServerStatus>;
  pollIntervalMs?: number;
}

/**
 * Calm "server is starting" state for free-tier cold starts, shown instead of an error.
 * It counts down the usual ~1 minute wake-up and polls /health until both servers are ready,
 * then invites the user to try again.
 */
export function ServerWakingNotice({
  onRetry,
  onDismiss,
  className = '',
  checkStatus = checkServerStatus,
  pollIntervalMs = 5000,
}: ServerWakingNoticeProps) {
  const [status, setStatus] = useState<ServerStatus>('waking');
  const [elapsed, setElapsed] = useState(0);
  const checkRef = useRef(checkStatus);
  checkRef.current = checkStatus;

  useEffect(() => {
    if (status === 'ready') return undefined;
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      const next = await checkRef.current();
      inFlight = false;
      if (!cancelled && next === 'ready') setStatus('ready');
    };

    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    const pollTimer = setInterval(() => void poll(), pollIntervalMs);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(pollTimer);
    };
  }, [status, pollIntervalMs]);

  const ready = status === 'ready';
  const remaining = Math.max(0, SERVER_WAKE_EXPECTED_SECONDS - elapsed);
  const progress = ready ? 100 : Math.min(95, Math.round((elapsed / SERVER_WAKE_EXPECTED_SECONDS) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      data-error-code="SERVER_WAKING"
      data-server-status={status}
      className={[
        'rounded-card border border-brand-ring bg-brand-soft p-4 text-text shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={[
              'mt-0.5 inline-block h-5 w-5 shrink-0 rounded-pill border-2 border-brand',
              ready ? 'bg-brand' : 'animate-spin border-t-transparent motion-reduce:animate-none',
            ].join(' ')}
          />
          <div>
            <p className="font-bold text-brand-dark">
              {ready ? 'Server sudah siap' : 'Server sedang dinyalakan'}
            </p>
            <p className="mt-0.5 text-sm text-text">
              {ready
                ? 'Terima kasih sudah menunggu. Silakan coba lagi.'
                : 'Server sedang dinyalakan, tunggu sekitar 1 menit. Dentify memakai server gratis yang beristirahat saat sepi, jadi permintaan pertama butuh waktu lebih lama.'}
            </p>
            {!ready && (
              <p className="mt-1 text-badge text-text-muted">
                {remaining > 0
                  ? `Perkiraan sekitar ${remaining} detik lagi…`
                  : 'Hampir siap, mohon tunggu sebentar lagi…'}
              </p>
            )}
            <div
              className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-pill bg-surface"
              role="progressbar"
              aria-label="Progres menyalakan server"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-full rounded-pill bg-brand transition-[width] duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRetry && (
            <AppButton variant={ready ? 'primary' : 'secondary'} onClick={onRetry}>
              Coba Lagi
            </AppButton>
          )}
          {onDismiss && (
            <AppButton variant="ghost" onClick={onDismiss} aria-label="Tutup pesan">
              Tutup
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServerWakingNotice;
