'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  MapPin,
  MessageCircleHeart,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { ScanReportData } from '../services/scanService';
import { downloadScanReportAsPng } from '../utils/downloadScanReport';
import { AiFeedbackControl } from './AiFeedbackControl';
import { AppButton } from './AppButton';
import { ClinicEscalationCard } from './ClinicEscalationCard';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import { StatusBadge, UnsureBadge } from './StatusBadge';

export interface ScanResultCardProps {
  report: ScanReportData;
  previewUrl?: string | null;
  onScanAgain?: () => void;
}

export const LOW_CONFIDENCE_WARNING_TEXT =
  'Hasil belum meyakinkan, silakan ambil ulang foto';

function describeConfidenceMeaning(score: number): string {
  if (score >= 0.85) {
    return 'Indikasi visual cukup kuat pada foto ini, namun tetap memerlukan pemeriksaan dokter gigi.';
  }
  if (score >= 0.75) {
    return 'Indikasi visual cukup jelas pada foto ini; gunakan sebagai skrining awal.';
  }
  return 'Indikasi visual masih lemah; gunakan hanya sebagai gambaran awal dan periksakan ke dokter gigi.';
}

/**
 * Dental screening report card.
 * Displays "Hasil analisis AI", honest confidence interpretation, structured Do's & Don'ts,
 * MedicalDisclaimerBanner, AiFeedbackControl, and action links. When the API marks the scan
 * `is_low_confidence` (below CONFIDENCE_THRESHOLD) it shows an "unsure, retake the photo" result
 * and never the model's label.
 */
export function ScanResultCard({ report, previewUrl, onScanAgain }: ScanResultCardProps) {
  const confidencePercent = Math.round(report.confidence_score * 100);
  const isUncertain = Boolean(report.is_low_confidence);
  const conditionQuery = isUncertain
    ? ''
    : `condition=${encodeURIComponent(report.primary_condition)}`;
  const deniHref = report.id
    ? `/chat?scan_id=${encodeURIComponent(report.id)}${conditionQuery ? `&${conditionQuery}` : ''}`
    : `/chat${conditionQuery ? `?${conditionQuery}` : ''}`;
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

      <div className="space-y-4 border-b border-border pb-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
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

            {isUncertain ? (
              <p className="text-badge text-text-muted">
                Keyakinan model AI terlalu rendah untuk menunjukkan indikasi kondisi tertentu, jadi
                Dentify tidak menampilkan tebakan.
              </p>
            ) : (
              <p className="text-badge text-text-muted">
                Tingkat keyakinan model AI:{' '}
                <strong className="font-bold text-text">{confidencePercent}%</strong> —{' '}
                <span>{describeConfidenceMeaning(report.confidence_score)}</span>
              </p>
            )}
          </div>

          {isUncertain ? (
            <UnsureBadge className="sm:mt-1" />
          ) : (
            <StatusBadge urgency={report.urgency_level} className="sm:mt-1 sm:max-w-[17rem]" />
          )}
        </div>

        {isUncertain && (
          <div
            role="note"
            data-testid="low-confidence-warning"
            className="space-y-4 rounded-card border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-950 sm:p-5"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900">{LOW_CONFIDENCE_WARNING_TEXT}</p>
                <p className="leading-relaxed text-amber-900/90">
                  Pencahayaan yang kurang merata, sudut kamera, atau gigi yang tertutup bisa membuat
                  foto sulit dianalisis. Ambil ulang foto mengikuti panduan memotret, dan periksakan
                  ke dokter gigi bila ada keluhan.
                </p>
              </div>
            </div>
            <div
              data-testid="low-confidence-actions"
              className={[
                'grid grid-cols-1 gap-2',
                onScanAgain ? 'md:grid-cols-3' : 'sm:grid-cols-2',
              ].join(' ')}
            >
              {onScanAgain && (
                <button
                  type="button"
                  onClick={onScanAgain}
                  data-testid="low-confidence-cta-retake"
                  className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-brand-dark"
                >
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Ambil Ulang Foto</span>
                </button>
              )}
              <Link
                href={deniHref}
                data-testid="low-confidence-cta-deni"
                className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-amber-700/30 bg-white px-3 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
              >
                <MessageCircleHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Tanya Deni</span>
              </Link>
              <Link
                href="/panduan#panduan-hasil-kurang-meyakinkan"
                data-testid="low-confidence-cta-panduan"
                className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-lg border border-amber-700/30 bg-white px-3 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100"
              >
                <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Panduan Memotret</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="overflow-hidden rounded-card border border-border bg-bg p-3">
          <img
            src={previewUrl}
            alt="Foto gigi yang dianalisis"
            className="mx-auto max-h-72 rounded-card object-contain"
          />
          {!isUncertain && report.detections.length > 0 && (
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
