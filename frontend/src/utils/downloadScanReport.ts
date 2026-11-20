/**
 * Generator kartu laporan hasil pemindaian foto gigi ke berkas PNG (HTML5 Canvas)
 * agar pengguna dapat mengunduh hasil scan langsung ke perangkat ("Unduh Hasil").
 */

import type { ScanReportData } from '../services/scanService';
import { formatJakartaDateTime } from './dateFormat';

export function downloadScanReportAsPng(report: ScanReportData): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 1120;
  const ctx = canvas.getContext('2d');

  const safeId = (report.id ?? 'quick').slice(-6);
  // Fallback unduh berkas teks ringkasan apabila context 2D tidak tersedia
  if (!ctx) {
    const textSummary = [
      '=== LAPORAN HASIL SKRINING GIGI DENTHUB ===',
      `ID Pemindaian  : ${report.id ?? 'quick'}`,
      `Waktu          : ${formatJakartaDateTime(report.created_at)}`,
      `Kondisi Utama  : ${report.condition_label}`,
      `Keyakinan AI   : ${Math.round(report.confidence_score * 100)}%`,
      `Tingkat Urgensi: ${report.urgency_level.toUpperCase()}`,
      '',
      `Ringkasan: ${report.care_recommendations.summary}`,
      '',
      "Yang Dianjurkan (Do's):",
      ...report.care_recommendations.dos.map((d) => `  + ${d}`),
      '',
      "Yang Harus Dihindari (Don'ts):",
      ...report.care_recommendations.donts.map((d) => `  - ${d}`),
      '',
      `Disclaimer Medis: ${report.medical_disclaimer}`,
    ].join('\n');

    const blob = new Blob([textSummary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DentHub-Laporan-${safeId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  const styles = window.getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  const colorBg = token('--color-bg', '#F8FAFC');
  const colorSurface = token('--color-surface', '#FFFFFF');
  const colorBrand = token('--color-brand', '#0369A1');
  const colorBrandDark = token('--color-brand-dark', '#075985');
  const colorBrandSoft = token('--color-brand-soft', '#F0F9FF');
  const colorBorder = token('--color-border', '#E2E8F0');
  const colorText = token('--color-text', '#0F172A');
  const colorTextMuted = token('--color-text-muted', '#475569');
  const colorGreen = token('--color-status-green', '#15803D');
  const colorYellow = token('--color-status-yellow', '#B45309');
  const colorRed = token('--color-status-red', '#B91C1C');

  // Main background
  ctx.fillStyle = colorBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header brand
  ctx.fillStyle = colorBrand;
  ctx.fillRect(0, 0, canvas.width, 130);

  ctx.fillStyle = colorSurface;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('DentHub — Laporan Skrining Kesehatan Gigi', 44, 58);

  ctx.font = '18px sans-serif';
  ctx.fillText(
    `ID: ${report.id ?? 'quick'}   •   Waktu: ${formatJakartaDateTime(report.created_at)}`,
    44,
    96,
  );

  // Main result card
  ctx.fillStyle = colorSurface;
  ctx.fillRect(40, 160, 880, 210);
  ctx.strokeStyle = colorBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 160, 880, 210);

  ctx.fillStyle = colorBrandDark;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('HASIL ANALISIS AI (COMPUTER VISION)', 68, 198);

  ctx.fillStyle = colorText;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(report.condition_label, 68, 240);

  const confPct = Math.round(report.confidence_score * 100);
  const urgencyColor =
    report.urgency_level === 'emergency'
      ? colorRed
      : report.urgency_level === 'medium'
        ? colorYellow
        : colorGreen;

  ctx.fillStyle = urgencyColor;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(
    `Skor Keyakinan AI: ${confPct}%   •   Tingkat Urgensi: ${report.urgency_level.toUpperCase()}`,
    68,
    284,
  );

  ctx.fillStyle = colorTextMuted;
  ctx.font = '17px sans-serif';
  ctx.fillText(report.care_recommendations.summary.slice(0, 105), 68, 330);

  // Do's section
  ctx.fillStyle = colorSurface;
  ctx.fillRect(40, 395, 880, 260);
  ctx.strokeRect(40, 395, 880, 260);

  ctx.fillStyle = colorGreen;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText("✓ Yang Dianjurkan (Do's)", 68, 435);

  ctx.fillStyle = colorText;
  ctx.font = '17px sans-serif';
  report.care_recommendations.dos.slice(0, 4).forEach((item, index) => {
    ctx.fillText(`• ${item.slice(0, 98)}`, 68, 478 + index * 40);
  });

  // Don'ts section
  ctx.fillStyle = colorSurface;
  ctx.fillRect(40, 680, 880, 230);
  ctx.strokeRect(40, 680, 880, 230);

  ctx.fillStyle = colorRed;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText("✕ Yang Harus Dihindari (Don'ts)", 68, 720);

  ctx.fillStyle = colorText;
  ctx.font = '17px sans-serif';
  report.care_recommendations.donts.slice(0, 3).forEach((item, index) => {
    ctx.fillText(`• ${item.slice(0, 98)}`, 68, 762 + index * 42);
  });

  // Medical disclaimer box
  ctx.fillStyle = colorBrandSoft;
  ctx.fillRect(40, 935, 880, 135);
  ctx.strokeStyle = colorBrand;
  ctx.strokeRect(40, 935, 880, 135);

  ctx.fillStyle = colorBrandDark;
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Penting — Disclaimer Medis Non-Diagnostik:', 68, 972);

  ctx.fillStyle = colorText;
  ctx.font = '15px sans-serif';
  ctx.fillText(
    'DentHub adalah alat skrining awal berbasis AI untuk pencegahan dan bukan pengganti diagnosis dokter gigi.',
    68,
    1006,
  );
  ctx.fillText(
    'Segera kunjungi dokter gigi jika Anda merasakan nyeri hebat atau pembengkakan.',
    68,
    1034,
  );

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `DentHub-Hasil-Scan-${safeId}.png`;
  link.click();
  return true;
}
