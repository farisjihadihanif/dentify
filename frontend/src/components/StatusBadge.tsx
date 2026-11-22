import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

export type UrgencyLevel = 'low' | 'medium' | 'emergency';
export type StatusBadgeSize = 'sm' | 'md';

export interface StatusBadgeProps {
  urgency: UrgencyLevel;
  customLabel?: string;
  /** `sm` shows the short label (lists, tight headers); `md` shows the full label. */
  size?: StatusBadgeSize;
  className?: string;
}

export interface UrgencyMeta {
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const URGENCY_METADATA: Record<UrgencyLevel, UrgencyMeta> = {
  low: {
    label: 'Perawatan Mandiri',
    shortLabel: 'Rawat mandiri',
    description: 'Kondisi dapat dipantau dengan kebersihan mulut rutin di rumah.',
    badgeClass: 'bg-status-green text-surface',
    icon: CheckCircle2,
  },
  medium: {
    label: 'Disarankan Periksa ke Dokter Gigi (1–2 minggu)',
    shortLabel: 'Periksa dalam 1–2 minggu',
    description: 'Disarankan menjadwalkan pemeriksaan ke dokter gigi dalam 1–2 minggu.',
    badgeClass: 'bg-status-yellow text-surface',
    icon: AlertCircle,
  },
  emergency: {
    label: 'Segera ke Dokter Gigi',
    shortLabel: 'Segera ke dokter gigi',
    description: 'Terdeteksi indikasi yang memerlukan penanganan dokter gigi segera.',
    badgeClass: 'bg-status-red text-surface',
    icon: AlertTriangle,
  },
};

export const UNSURE_CHIP_LABEL = 'Belum meyakinkan';

// Compact chip: sized to its content, never wider than its container, at most two balanced lines.
const CHIP_BASE =
  'inline-flex w-fit max-w-full shrink-0 items-center gap-1.5 rounded-pill font-semibold leading-tight [text-wrap:balance]';
const CHIP_SIZE: Record<StatusBadgeSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-[0.8125rem]',
};

/**
 * Screening urgency badge.
 */
export function StatusBadge({
  urgency,
  customLabel,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const meta = URGENCY_METADATA[urgency] ?? URGENCY_METADATA.low;
  const Icon = meta.icon;
  const text = customLabel || (size === 'sm' ? meta.shortLabel : meta.label);

  return (
    <span
      role="status"
      data-urgency={urgency}
      title={meta.label}
      className={[CHIP_BASE, CHIP_SIZE[size], meta.badgeClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{text}</span>
      {text !== meta.label && <span className="sr-only">: {meta.label}</span>}
    </span>
  );
}

export interface UnsureBadgeProps {
  size?: StatusBadgeSize;
  className?: string;
}

/**
 * Neutral chip for a scan below CONFIDENCE_THRESHOLD: it carries no urgency, so it never uses
 * the status colours.
 */
export function UnsureBadge({ size = 'md', className = '' }: UnsureBadgeProps) {
  return (
    <span
      role="status"
      data-testid="unsure-badge"
      className={[
        CHIP_BASE,
        CHIP_SIZE[size],
        'border border-border bg-bg text-text-muted',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{UNSURE_CHIP_LABEL}</span>
    </span>
  );
}

export default StatusBadge;
