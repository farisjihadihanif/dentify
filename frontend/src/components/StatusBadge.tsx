import React from 'react';

export type UrgencyLevel = 'low' | 'medium' | 'emergency';

export interface StatusBadgeProps {
  urgency: UrgencyLevel;
  customLabel?: string;
  className?: string;
}

export interface UrgencyMeta {
  label: string;
  description: string;
  badgeClass: string;
  iconSymbol: string;
}

export const URGENCY_METADATA: Record<UrgencyLevel, UrgencyMeta> = {
  low: {
    label: 'Perawatan Mandiri',
    description: 'Kondisi dapat dipantau dengan kebersihan mulut rutin di rumah.',
    badgeClass: 'bg-status-green text-surface',
    iconSymbol: '✓',
  },
  medium: {
    label: 'Disarankan Periksa ke Dokter Gigi (1–2 minggu)',
    description: 'Disarankan menjadwalkan pemeriksaan ke dokter gigi dalam 1–2 minggu.',
    badgeClass: 'bg-status-yellow text-surface',
    iconSymbol: '!',
  },
  emergency: {
    label: 'Segera ke Dokter Gigi',
    description: 'Terdeteksi indikasi yang memerlukan penanganan dokter gigi segera.',
    badgeClass: 'bg-status-red text-surface',
    iconSymbol: '▲',
  },
};

/**
 * Badge tingkat urgensi hasil screening (`DESIGN.md §4.2` & `§3.2`):
 * mengombinasikan warna token (`status-green`, `status-yellow`, `status-red`),
 * simbol ikon, dan label teks berbahasa Indonesia yang jelas.
 */
export function StatusBadge({ urgency, customLabel, className = '' }: StatusBadgeProps) {
  const meta = URGENCY_METADATA[urgency] ?? URGENCY_METADATA.low;

  return (
    <span
      role="status"
      data-urgency={urgency}
      className={[
        'inline-flex items-center gap-2 rounded-pill px-3.5 py-1.5 text-badge font-semibold',
        meta.badgeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className="font-bold">
        {meta.iconSymbol}
      </span>
      <span>{customLabel || meta.label}</span>
    </span>
  );
}

export default StatusBadge;
