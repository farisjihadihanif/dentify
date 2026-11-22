import React from 'react';

export const STANDARD_MEDICAL_DISCLAIMER =
  'Penting: Dentify adalah alat skrining awal berbasis AI untuk pencegahan dan bukan pengganti diagnosis dokter gigi. Hasil ini bukan diagnosis medis. Segera kunjungi dokter gigi jika Anda merasakan nyeri hebat atau pembengkakan.';

export const STANDARD_CHAT_DISCLAIMER =
  'Saran Deni bersifat edukatif dan tidak menggantikan pemeriksaan langsung oleh dokter gigi.';

export interface MedicalDisclaimerBannerProps {
  message?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Komponen peringatan wajib non-diagnostik.
 * Digunakan pada halaman `/scan`, `/chat`, dan laporan riwayat.
 */
export function MedicalDisclaimerBanner({
  message = STANDARD_MEDICAL_DISCLAIMER,
  compact = false,
  className = '',
}: MedicalDisclaimerBannerProps) {
  return (
    <aside
      role="note"
      aria-label="Disclaimer Medis"
      className={[
        'rounded-card border border-border bg-brand-soft text-text',
        compact ? 'p-3 text-badge' : 'p-4 text-badge',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-surface"
        >
          i
        </span>
        <p className="leading-relaxed text-text">
          <strong className="font-semibold text-brand-dark">Disclaimer Medis: </strong>
          <span>{message}</span>
        </p>
      </div>
    </aside>
  );
}

export default MedicalDisclaimerBanner;
