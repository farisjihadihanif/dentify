'use client';

import React, { useEffect } from 'react';
import { BookOpen, CheckCircle2, Clock, ExternalLink, X } from 'lucide-react';

export interface ArticleReferenceSource {
  label: string;
  url: string;
}

export interface DentalEducationArticle {
  id: string;
  stepNumber: string;
  category: string;
  title: string;
  readTime: string;
  summary: string;
  paragraphs: readonly string[];
  takeaways: readonly string[];
  sources: readonly ArticleReferenceSource[];
}

export const DENTIST_WORLD_ARTICLES: readonly DentalEducationArticle[] = [
  {
    id: 'scaling-rutin',
    stepNumber: '01',
    category: 'Perawatan Preventif',
    title: 'Pemeriksaan Rutin & Scaling Karang Gigi (Tiap 6 Bulan)',
    readTime: '3 menit baca',
    summary:
      'Karang gigi (calculus) yang telah mengeras tidak dapat dibersihkan hanya dengan sikat gigi biasa. Dokter gigi menggunakan ultrasonic scaler untuk membersihkan plak dan karang tanpa merusak email gigi.',
    paragraphs: [
      'Menurut World Health Organization (WHO), penyakit rongga mulut seperti karies dan penyakit gusi merupakan masalah kesehatan yang paling umum di dunia, namun sebagian besar dapat dicegah melalui kebersihan gigi harian dan pemeriksaan berkala. Plak gigi terbentuk terus-menerus dari lapisan bakteri dan sisa makanan; apabila tidak dibersihkan sempurna dalam 24–72 jam, mineral air liur akan mengeraskannya menjadi karang gigi (calculus).',
      'Kementerian Kesehatan RI (Kemenkes RI) menganjurkan pemeriksaan kesehatan gigi dan mulut secara rutin setiap 6 bulan sekali. Begitu plak mengeras menjadi karang gigi di sepanjang garis gusi, menyikat gigi lebih keras tidak dapat menghilangkannya dan justru berisiko menyebabkan abrasi email serta resesi gusi.',
      'Di klinik gigi, dokter gigi melakukan prosedur scaling menggunakan alat ultrasonic scaler yang memancarkan getaran mikro dan semprotan air steril untuk melepaskan karang gigi secara aman. Pembersihan rutin membantu mencegah radang gusi (gingivitis) berkembang menjadi periodontitis yang dapat menggoyangkan gigi.',
    ],
    takeaways: [
      'Jadwalkan kontrol dan scaling ke dokter gigi setiap 6 bulan sekali meskipun belum ada keluhan nyeri.',
      'Sikat gigi dua kali sehari selama 2 menit (pagi setelah sarapan dan malam sebelum tidur) dengan pasta gigi berfluoride.',
      'Bersihkan sela gigi sekali sehari menggunakan benang gigi (dental floss) untuk menekan penumpukan plak.',
    ],
    sources: [
      {
        label: 'WHO — Oral Health Fact Sheet',
        url: 'https://www.who.int/news-room/fact-sheets/detail/oral-health',
      },
      {
        label: 'Kemenkes RI — Ayo Sehat: Cara Merawat Kesehatan Gigi dan Mulut',
        url: 'https://ayosehat.kemkes.go.id/',
      },
    ],
  },
  {
    id: 'penambalan-karies',
    stepNumber: '02',
    category: 'Tindakan Restoratif',
    title: 'Penambalan Karies Dini & Konservasi Struktur Gigi',
    readTime: '4 menit baca',
    summary:
      'Lubang gigi (karies) tahap awal yang ditangani sedini mungkin dapat ditambal dengan bahan komposit sewarna gigi dalam satu kali kunjungan, sebelum infeksi mencapai jaringan saraf (pulpa).',
    paragraphs: [
      'American Dental Association (ADA) menjelaskan bahwa karies gigi terjadi ketika bakteri plak mengubah gula dari makanan dan minuman menjadi asam yang secara bertahap melarutkan mineral email gigi. Pada tahap paling awal, lesi karies sering muncul sebagai bercak putih kapur atau bayangan gelap ringan tanpa rasa sakit.',
      'Jika terdeteksi dini sebelum menembus lapisan dentin dalam, dokter gigi dapat melakukan tindakan konservasi berupa pembersihan jaringan karies lalu menutup kavitas menggunakan resin komposit sewarna gigi. Prosedur ini mempertahankan struktur alami gigi dan biasanya selesai dalam satu kali kunjungan.',
      'Menunda pemeriksaan hingga karies mencapai ruang pulpa (saraf gigi) dapat memicu nyeri spontan hebat, pembengkakan, serta membutuhkan perawatan saluran akar (endodontik) yang memerlukan beberapa kali kunjungan dengan biaya lebih tinggi.',
    ],
    takeaways: [
      'Periksakan bercak cokelat/hitam atau rasa ngilu ringan lebih awal tanpa menunggu nyeri hebat.',
      'Batasi konsumsi minuman manis, bersoda, dan camilan lengket di antara waktu makan utama sesuai anjuran WHO.',
      'Gunakan pasta gigi berfluoride untuk membantu remineralisasi lapisan email setiap hari.',
    ],
    sources: [
      {
        label: 'American Dental Association (ADA) — Tooth Decay & Cavities',
        url: 'https://www.mouthhealthy.org/all-topics-a-z/decay',
      },
      {
        label: 'WHO — Sugars and Dental Caries Technical Note',
        url: 'https://www.who.int/news-room/fact-sheets/detail/oral-health',
      },
    ],
  },
  {
    id: 'tanda-darurat-klinik',
    stepNumber: '03',
    category: 'Waspada Darurat Medis',
    title: 'Tanda Darurat Gigi yang Memerlukan Penanganan Segera',
    readTime: '3 menit baca',
    summary:
      'Segera kunjungi dokter gigi apabila Anda mengalami nyeri gigi berdenyut hebat yang mengganggu tidur, pembengkakan gusi atau pipi, keluarnya nanah (abses), atau pendarahan yang tidak berhenti.',
    paragraphs: [
      'Panduan darurat kedokteran gigi dari American Dental Association (ADA) membedakan keluhan yang dapat dijadwalkan rutin dengan kondisi darurat yang memerlukan penanganan segera. Infeksi bakteri dari gigi berlubang dalam dapat menyebar ke jaringan sekitar akar dan membentuk abses (kantong nanah).',
      'Tanda bahaya yang tidak boleh ditunda mencakup pembengkakan pada gusi, pipi, atau rahang; demam yang menyertai sakit gigi; nyeri berdenyut tajam yang mengganggu tidur; pendarahan gusi yang tidak kunjung berhenti; serta gigi patah atau lepas akibat benturan.',
      'Sambil menuju fasilitas layanan gigi terdekat, hindari menusuk gusi yang bengkak, hindari kompres hangat di area pipi bengkak, dan jangan menempelkan obat atau bahan kimia langsung pada gigi yang berlubang.',
    ],
    takeaways: [
      'Gunakan fitur Cari Klinik Terdekat di DentHub segera bila muncul bengkak, nanah, demam, atau nyeri berdenyut hebat.',
      'Gunakan kompres dingin di bagian luar pipi selama 10–15 menit untuk membantu mengurangi rasa tidak nyaman sementara.',
      'Bawa ringkasan hasil skrining DentHub dan daftar keluhan untuk mempercepat pemeriksaan awal oleh dokter gigi.',
    ],
    sources: [
      {
        label: 'American Dental Association (ADA) — Dental Emergencies',
        url: 'https://www.mouthhealthy.org/dental-care-concerns/dental-emergencies',
      },
      {
        label: 'Kemenkes RI — Layanan Kesehatan Gigi dan Mulut',
        url: 'https://ayosehat.kemkes.go.id/',
      },
    ],
  },
  {
    id: 'persiapan-kunjungan',
    stepNumber: '04',
    category: 'Tips Pasien Cerdas',
    title: 'Persiapan Praktis Sebelum Berkunjung ke Dokter Gigi',
    readTime: '3 menit baca',
    summary:
      'Unduh hasil laporan skrining DentHub Anda untuk ditunjukkan kepada dokter gigi, sikat gigi secara lembut sebelum berangkat, dan catat riwayat alergi obat atau keluhan yang Anda rasakan.',
    paragraphs: [
      'Komunikasi yang jelas antara pasien dan dokter gigi berperan penting dalam menentukan rencana perawatan yang tepat. Sebelum berkunjung ke klinik, catat sejak kapan keluhan muncul, pemicu ngilu (dingin, panas, manis, atau saat mengunyah), serta lokasi gigi yang terasa mengganggu.',
      'Bila Anda sudah melakukan skrining mandiri menggunakan DentHub, unduh kartu laporan hasil skrining (PNG) di perangkat Anda. Meskipun hasil AI bersifat skrining awal non-diagnostik, catatan gejala dan dokumentasi visual yang terstruktur membantu dokter gigi menggali riwayat keluhan lebih cepat.',
      'Sesuai standar keselamatan pasien Kemenkes RI dan ADA, pastikan Anda menyampaikan riwayat penyakit sistemik (seperti diabetes atau hipertensi), obat-obatan rutin yang sedang dikonsumsi, status kehamilan, serta riwayat alergi obat sebelum prosedur dimulai.',
    ],
    takeaways: [
      'Sikat gigi dengan lembut dan berkumur air bersih sebelum datang ke klinik.',
      'Siapkan daftar obat rutin, riwayat alergi, serta catatan pola nyeri atau ngilu yang Anda alami.',
      'Tanyakan rencana perawatan preventif dan jadwal kontrol berikutnya kepada dokter gigi Anda.',
    ],
    sources: [
      {
        label: 'American Dental Association (ADA) — Visiting the Dentist',
        url: 'https://www.mouthhealthy.org/dental-care-concerns',
      },
      {
        label: 'Kemenkes RI — Pedoman Kesehatan Gigi dan Mulut',
        url: 'https://ayosehat.kemkes.go.id/',
      },
    ],
  },
];

export interface DentalArticleModalProps {
  article: DentalEducationArticle | null;
  onClose: () => void;
}

/**
 * Accessible Article Reader Pop-Up Modal (`DentalArticleModal.tsx`, docs/DESIGN.md §3.6):
 * - Opens on clicking any "Informasi Seputar Dunia Dentist & Perawatan Gigi" item on `/panduan`
 * - Displays full multi-paragraph Indonesian article, authoritative source citations (WHO/ADA/Kemenkes RI),
 *   and practical daily care takeaways; closable via close button, backdrop click, or Escape key.
 */
export function DentalArticleModal({ article, onClose }: DentalArticleModalProps) {
  useEffect(() => {
    if (!article) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [article, onClose]);

  if (!article) {
    return null;
  }

  return (
    <div
      data-testid="dental-article-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-text/60 p-4 sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dental-article-modal-title"
        data-testid="dental-article-modal"
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-bg px-5 py-4 sm:px-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-pill bg-brand-soft px-3 py-0.5 text-xs font-bold text-brand-dark">
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{article.category}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{article.readTime}</span>
              </span>
            </div>
            <h3
              id="dental-article-modal-title"
              className="text-xl font-bold leading-snug text-text sm:text-2xl"
            >
              {article.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela artikel"
            data-testid="dental-article-modal-close"
            className="inline-flex h-10 w-10 min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill border border-border bg-surface text-text opacity-100 shadow-md transition-transform hover:scale-105 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-3.5 text-sm leading-relaxed text-text sm:text-base">
            {article.paragraphs.map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          <div className="rounded-card border border-border bg-brand-soft p-4 sm:p-5">
            <p className="text-sm font-bold text-brand-dark">Poin Praktis untuk Anda</p>
            <ul className="mt-2.5 space-y-2">
              {article.takeaways.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-text">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-green"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            data-testid="dental-article-sources"
            className="rounded-card border border-border bg-bg p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Referensi Sumber Kesehatan Gigi
            </p>
            <ul className="mt-2 space-y-1.5">
              {article.sources.map((src) => (
                <li key={src.label}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-dark hover:underline"
                  >
                    <span>{src.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border bg-bg px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            data-testid="dental-article-modal-close-btn"
            className="inline-flex h-10 min-h-touch items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-semibold text-surface transition-colors hover:bg-brand-dark"
          >
            <span>Tutup Artikel</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DentalArticleModal;
