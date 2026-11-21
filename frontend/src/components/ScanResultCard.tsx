'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  MapPin,
  MessageCircleHeart,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ScanReportData } from '../services/scanService';
import { downloadScanReportAsPng } from '../utils/downloadScanReport';
import { AiFeedbackControl } from './AiFeedbackControl';
import { AppButton } from './AppButton';
import { ClinicEscalationCard } from './ClinicEscalationCard';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import { StatusBadge } from './StatusBadge';

export interface ScanResultCardProps {
  report: ScanReportData;
  previewUrl?: string | null;
  onScanAgain?: () => void;
}

export const LOW_CONFIDENCE_WARNING_TEXT =
  'Hasil kurang pasti, pertimbangkan mengambil ulang foto';

function describeConfidenceMeaning(score: number): string {
  if (score >= 0.85) {
    return 'Indikasi visual cukup kuat pada foto ini, namun tetap memerlukan pemeriksaan dokter gigi.';
  }
  if (score >= 0.75) {
    return 'Indikasi visual cukup jelas pada foto ini; gunakan sebagai skrining awal.';
  }
  return LOW_CONFIDENCE_WARNING_TEXT;
}

/**
 * Dental screening report card (docs/DESIGN.md §3.2 & §8.3).
 * Displays "Hasil analisis AI", honest confidence interpretation (<0.75 warning),
 * structured Do's & Don'ts, MedicalDisclaimerBanner, AiFeedbackControl, and action links.
 */
export function ScanResultCard({ report, previewUrl, onScanAgain }: ScanResultCardProps) {
  const confidencePercent = Math.round(report.confidence_score * 100);
  const isUncertain = Boolean(report.is_low_confidence) || report.confidence_score < 0.75;
  const deniHref = report.id
    ? `/chat?scan_id=${encodeURIComponent(report.id)}&condition=${encodeURIComponent(
        report.primary_condition,
      )}`
    : `/chat?condition=${encodeURIComponent(report.primary_condition)}`;
  const clinicsHref = report.id
    ? `/clinics?from_scan=${encodeURIComponent(report.id)}`
    : '/clinics';

  const handleDownload = () => {
    downloadScanReportAsPng(report);
  };

  return (
    <section
      aria-label="Laporan Hasil Analisis Gigi"
      className="space-y-6 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8"
    >
      <MedicalDisclaimerBanner message={report.medical_disclaimer} />

      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-start">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              data-testid="scan-ai-label"
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-brand-soft px-3 py-0.5 text-xs font-semibold text-brand-dark"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Hasil analisis AI</span>
            </span>
            <span className="text-xs text-text-muted">
              Sumber foto: {report.capture_source === 'camera' ? 'Kamera Langsung' : 'Unggahan File'}
            </span>
          </div>

          <h2 className="text-screen-title text-text">{report.condition_label}</h2>

          <p className="text-badge text-text-muted">
            Tingkat keyakinan model AI:{' '}
            <strong className="font-bold text-text">{confidencePercent}%</strong> —{' '}
            <span>{describeConfidenceMeaning(report.confidence_score)}</span>
          </p>

          {isUncertain && (
            <p
              role="note"
              data-testid="low-confidence-warning"
              className="inline-flex items-center gap-1.5 rounded-lg border border-status-yellow/40 bg-bg px-3 py-1.5 text-xs font-semibold text-status-yellow dark:border-amber-800/40 dark:bg-amber-950/50 dark:text-amber-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{LOW_CONFIDENCE_WARNING_TEXT}</span>
            </p>
          )}
        </div>

        <StatusBadge urgency={report.urgency_level} />
      </div>

      {previewUrl && (
        <div className="overflow-hidden rounded-card border border-border bg-bg p-3">
          <img
            src={previewUrl}
            alt="Foto gigi yang dianalisis"
            className="mx-auto max-h-72 rounded-card object-contain"
          />
          {report.detections.length > 0 && (
            <p className="mt-2 text-center text-badge text-text-muted">
              Terdeteksi {report.detections.length} area fokus ({report.detections[0].label} •{' '}
              {Math.round(report.detections[0].confidence * 100)}%)
            </p>
          )}
        </div>
      )}

      {report.trigger_clinic_finder && (
        <ClinicEscalationCard
          scanId={report.id}
          sourceLabel="Hasil skrining atau keluhan Anda menunjukkan tingkat urgensi darurat. Segera kunjungi dokter gigi terdekat:"
          testId="clinic-finder-escalation-card"
        />
      )}

      <div className="rounded-card border border-border bg-bg p-5">
        <h3 className="text-card-title text-text">Ringkasan Rekomendasi Perawatan Mandiri</h3>
        <p className="mt-1.5 text-body text-text-muted">{report.care_recommendations.summary}</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-card border border-border bg-surface p-4">
            <h4 className="flex items-center gap-2 text-card-title text-status-green">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Yang Dianjurkan (Do&apos;s)</span>
            </h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-badge text-text">
              {report.care_recommendations.dos.map((item, idx) => (
                <li key={`do-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-card border border-border bg-surface p-4">
            <h4 className="flex items-center gap-2 text-card-title text-status-red">
              <XCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Yang Harus Dihindari (Don&apos;ts)</span>
            </h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-badge text-text">
              {report.care_recommendations.donts.map((item, idx) => (
                <li key={`dont-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <AiFeedbackControl targetType="scan" targetId={report.id ?? 'quick-scan'} />

      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <AppButton
            variant="secondary"
            size="md"
            onClick={handleDownload}
            data-testid="download-scan-result-btn"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Unduh Hasil</span>
          </AppButton>

          <Link
            href={deniHref}
            className="inline-flex h-10 min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-deni px-4 text-sm font-semibold text-surface shadow-sm transition-opacity hover:opacity-95"
          >
            <MessageCircleHeart className="h-4 w-4 shrink-0" />
            <span>Tanya Deni Lebih Lanjut</span>
          </Link>

          <Link
            href={clinicsHref}
            className="inline-flex h-10 min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-4 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-brand-dark"
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Cari Klinik Terdekat</span>
          </Link>
        </div>

        {onScanAgain && (
          <button
            type="button"
            onClick={onScanAgain}
            className="inline-flex h-9 min-h-touch items-center justify-center whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
          >
            + Scan Foto Baru
          </button>
        )}
      </div>
    </section>
  );
}

export default ScanResultCard;
