import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

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
  icon: React.ComponentType<{ className?: string }>;
}

export const URGENCY_METADATA: Record<UrgencyLevel, UrgencyMeta> = {
  low: {
    label: 'Perawatan Mandiri',
    description: 'Kondisi dapat dipantau dengan kebersihan mulut rutin di rumah.',
    badgeClass: 'bg-status-green text-surface',
    icon: CheckCircle2,
  },
  medium: {
    label: 'Disarankan Periksa ke Dokter Gigi (1–2 minggu)',
    description: 'Disarankan menjadwalkan pemeriksaan ke dokter gigi dalam 1–2 minggu.',
    badgeClass: 'bg-status-yellow text-surface',
    icon: AlertCircle,
  },
  emergency: {
    label: 'Segera ke Dokter Gigi',
    description: 'Terdeteksi indikasi yang memerlukan penanganan dokter gigi segera.',
    badgeClass: 'bg-status-red text-surface',
    icon: AlertTriangle,
  },
};

/**
 * Screening urgency badge.
 */
export function StatusBadge({ urgency, customLabel, className = '' }: StatusBadgeProps) {
  const meta = URGENCY_METADATA[urgency] ?? URGENCY_METADATA.low;
  const Icon = meta.icon;

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
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{customLabel || meta.label}</span>
    </span>
  );
}

export default StatusBadge;
