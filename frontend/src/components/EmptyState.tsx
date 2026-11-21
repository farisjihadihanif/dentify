import React from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { AppButton } from './AppButton';

export const DEFAULT_HISTORY_EMPTY_TEXT =
  'Belum ada riwayat screening gigi. Mulai pemindaian pertama Anda untuk memantau kesehatan gigi secara berkala.';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onActionClick?: () => void;
  className?: string;
}

/**
 * Komponen tampilan saat data/riwayat kosong.
 */
export function EmptyState({
  title = 'Belum Ada Riwayat Pemindaian',
  description = DEFAULT_HISTORY_EMPTY_TEXT,
  actionLabel = 'Mulai Screening Sekarang →',
  actionHref = '/scan',
  onActionClick,
  className = '',
}: EmptyStateProps) {
  return (
    <section
      aria-label={title}
      className={[
        'rounded-card border border-border bg-surface p-8 text-center shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-pill bg-brand-soft text-brand-dark">
        <ClipboardList className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-card-title text-text">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-body text-text-muted">{description}</p>

      <div className="mt-6 flex justify-center">
        {onActionClick ? (
          <AppButton variant="primary" onClick={onActionClick}>
            {actionLabel}
          </AppButton>
        ) : (
          <Link
            href={actionHref}
            className="inline-flex min-h-cta items-center justify-center rounded-card bg-brand px-6 py-3 text-body font-semibold text-surface transition-colors hover:bg-brand-dark"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export default EmptyState;
