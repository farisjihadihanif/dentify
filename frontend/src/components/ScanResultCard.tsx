'use client';

import React from 'react';
import Link from 'next/link';
import { Download, MapPin, MessageCircleHeart } from 'lucide-react';
import type { ScanReportData } from '../services/scanService';
import { downloadScanReportAsPng } from '../utils/downloadScanReport';
import { AppButton } from './AppButton';
import { ClinicEscalationCard } from './ClinicEscalationCard';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import { StatusBadge } from './StatusBadge';

export interface ScanResultCardProps {
  report: ScanReportData;
  previewUrl?: string | null;
  onScanAgain?: () => void;
}

export function ScanResultCard({ report, previewUrl, onScanAgain }: ScanResultCardProps) {
  const confidencePercent = Math.round(report.confidence_score * 100);
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

      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-badge font-semibold text-brand-dark">Hasil Screening Computer Vision</p>
          <h2 className="mt-1 text-screen-title text-text">{report.condition_label}</h2>
          <p className="mt-1 text-badge text-text-muted">
            Tingkat keyakinan model AI:{' '}
            <strong className="font-bold text-text">{confidencePercent}%</strong> • Sumber foto:{' '}
            <span>{report.capture_source === 'camera' ? 'Kamera Langsung' : 'Unggahan File'}</span>
          </p>
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
              <span aria-hidden="true">✓</span>
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
              <span aria-hidden="true">✕</span>
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

      {/* Tombol Aksi Utama Pasca-Scan: Unduh Hasil, Tanya Lebih Lanjut ke Deni, & Cari Klinik Terdekat */}
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
            className="inline-flex h-9 min-h-touch items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
          >
            + Scan Foto Baru
          </button>
        )}
      </div>
    </section>
  );
}

export default ScanResultCard;
