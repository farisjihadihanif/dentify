'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Plus, Trash2, History, Camera, Upload } from 'lucide-react';
import { AppButton } from './AppButton';
import { ErrorBanner } from './ErrorBanner';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import { ScanResultCard } from './ScanResultCard';
import { StatusBadge } from './StatusBadge';
import {
  PHOTO_LIGHTING_GUIDE_TEXT,
  WebcamCapture,
} from './WebcamCapture';
import { isAuthenticated } from '../services/authService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';
import {
  deleteScanById,
  fetchScanDetailById,
  fetchScanHistory,
  submitDentalScan,
  type CaptureSource,
  type ScanReportData,
} from '../services/scanService';
import { formatJakartaDateTime } from '../utils/dateFormat';
import {
  compressClientImage,
  validateClientImageFile,
} from '../utils/imageHelper';

export const LOADING_PROGRESS_STEPS = [
  'Mengunggah foto…',
  'Menganalisis gigi…',
  'Menyusun rekomendasi…',
] as const;

export interface ScanWorkspaceProps {
  initialHistory?: ScanReportData[];
  initialReport?: ScanReportData | null;
}

/**
 * Workspace utama halaman AI Scan (`/scan`):
 * - Berposisi di tengah seperti layout form (`max-w-6xl` dengan form tengah & sidebar riwayat)
 * - Sidebar di sisi kiri berisi tombol **"+ Tambah Scan Baru"** dan daftar **Riwayat Scan**
 *   (logika sama dengan sidebar chat Deni: klik riwayat untuk membuka hasil scan lama, atau hapus)
 * - Form tengah mendukung **Gunakan Kamera** (`WebcamCapture`) atau **Menyertakan File** (`Unggah dari Galeri`)
 * - Setelah scan selesai, menampilkan `ScanResultCard` lengkap dengan tombol:
 *   1. **Unduh Hasil**
 *   2. **Tanya Lebih Lanjut ke Deni**
 *   3. **Cari Klinik Terdekat**
 */
export function ScanWorkspace({
  initialHistory = [],
  initialReport = null,
}: ScanWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<CaptureSource>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userSymptoms, setUserSymptoms] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStepIndex, setProgressStepIndex] = useState(0);
  const [report, setReport] = useState<ScanReportData | null>(initialReport);
  const [historyItems, setHistoryItems] = useState<ScanReportData[]>(initialHistory);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadHistoryList = useCallback(async () => {
    if (!isAuthenticated()) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchScanHistory(1, 20);
      setHistoryItems(res.data || []);
    } catch {
      // Biarkan daftar kosong bila belum ada riwayat
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (initialHistory.length === 0 && isAuthenticated()) {
      void loadHistoryList();
    }
  }, [initialHistory.length, loadHistoryList]);

  useEffect(() => {
    if (!isAnalyzing) {
      setProgressStepIndex(0);
      return undefined;
    }
    const interval = window.setInterval(() => {
      setProgressStepIndex((prev) =>
        prev < LOADING_PROGRESS_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 1100);
    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const resetFileInput = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartNewScan = () => {
    setReport(null);
    setUiError(null);
    setUserSymptoms('');
    resetFileInput();
  };

  const handleSelectHistoryItem = async (item: ScanReportData) => {
    setUiError(null);
    setPreviewUrl(null);
    if (!item.id) {
      setReport(item);
      return;
    }
    try {
      const detail = await fetchScanDetailById(item.id);
      setReport(detail);
    } catch {
      setReport(item);
    }
  };

  const handleDeleteHistoryItem = async (scanId: string | null) => {
    if (!scanId) return;
    setDeletingId(scanId);
    setUiError(null);
    try {
      await deleteScanById(scanId);
      setHistoryItems((prev) => prev.filter((item) => item.id !== scanId));
      if (report?.id === scanId) {
        setReport(null);
      }
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGalleryFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUiError(null);

    if (!file) {
      resetFileInput();
      return;
    }

    const validation = validateClientImageFile(file);
    if (!validation.valid && validation.error) {
      resetFileInput();
      setUiError(validation.error);
      return;
    }

    setSelectedFile(file);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleCameraCapture = (file: File, dataUrl: string) => {
    setUiError(null);
    const validation = validateClientImageFile(file);
    if (!validation.valid && validation.error) {
      setUiError(validation.error);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(dataUrl);
  };

  const handleAnalyzeSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedFile || isAnalyzing || cooldownLeft > 0) return;

    const validation = validateClientImageFile(selectedFile);
    if (!validation.valid && validation.error) {
      resetFileInput();
      setUiError(validation.error);
      return;
    }

    setUiError(null);
    setIsAnalyzing(true);

    try {
      const optimizedFile = await compressClientImage(selectedFile);
      const result = await submitDentalScan({
        image: optimizedFile,
        captureSource: activeTab,
        userSymptoms,
      });
      setReport(result);
      setHistoryItems((prev) => [result, ...prev.filter((i) => i.id !== result.id)]);
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);

      if (mapped.action === 'reset_file_input') {
        resetFileInput();
      } else if (mapped.action === 'cooldown_submit_10s') {
        setCooldownLeft(mapped.cooldownSeconds ?? 10);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">
          Pemindaian Kesehatan Gigi Mandiri
        </h1>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-text-muted sm:text-base">
          Gunakan kamera langsung atau sertakan file foto gigi Anda untuk mendapatkan laporan
          deteksi dini yang dapat diunduh.
        </p>
      </div>

      {uiError && (
        <div className="space-y-2">
          <ErrorBanner
            error={uiError}
            onRetry={selectedFile ? () => void handleAnalyzeSubmit() : undefined}
            onDismiss={() => setUiError(null)}
          />
          {uiError.code === 'LOW_QUALITY_IMAGE' && (
            <div
              role="note"
              data-testid="retake-guidance-card"
              className="rounded-card border border-border bg-brand-soft p-4 text-badge text-text"
            >
              <p className="font-semibold text-brand-dark">Tips Mengambil Ulang Foto yang Jelas:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-text-muted">
                <li>Gunakan pencahayaan terang dan merata (hadap sumber cahaya).</li>
                <li>Bersihkan sisa makanan terlebih dahulu agar tidak memicu deteksi keliru.</li>
                <li>Tahan kamera dengan stabil dan pastikan area gigi terlihat fokus.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:hidden">
          <AppButton variant="secondary" size="sm" onClick={() => setSidebarOpen((prev) => !prev)}>
            <History className="h-4 w-4 shrink-0" />
            <span>{sidebarOpen ? 'Tutup Riwayat Scan' : 'Buka Riwayat Scan'}</span>
          </AppButton>
        </div>

        <aside
          aria-label="Sidebar Riwayat Scan"
          data-testid="scan-history-sidebar"
          className={[
            'space-y-4 rounded-card border border-border bg-surface p-4 shadow-sm lg:col-span-4 lg:block',
            sidebarOpen ? 'block' : 'hidden',
          ].join(' ')}
        >
          <AppButton
            variant="primary"
            size="md"
            fullWidth
            onClick={handleStartNewScan}
            data-testid="new-scan-btn"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Tambah Scan Baru</span>
          </AppButton>

          <div className="flex items-center justify-between border-b border-border pb-2 pt-1">
            <span className="inline-flex items-center gap-1.5 text-badge font-bold text-text">
              <History className="h-4 w-4 text-brand-dark" />
              <span>Riwayat Scan Anda ({historyItems.length})</span>
            </span>
          </div>

          {isLoadingHistory ? (
            <p className="py-6 text-center text-badge text-text-muted">
              Memuat riwayat pemindaian...
            </p>
          ) : historyItems.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-bg p-4 text-center text-badge text-text-muted">
              Belum ada riwayat skrining gigi. Mulai pemindaian pertama Anda untuk memantau
              kesehatan gigi secara rutin.
            </div>
          ) : (
            <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1">
              {historyItems.map((item) => {
                const itemKey = item.id ?? item.created_at;
                const isSelected = Boolean(item.id && report?.id === item.id);
                const confPct = Math.round(item.confidence_score * 100);
                return (
                  <li
                    key={itemKey}
                    className={[
                      'rounded-card border p-3 transition-colors',
                      isSelected
                        ? 'border-brand bg-brand-soft'
                        : 'border-border bg-bg hover:bg-brand-soft/60',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSelectHistoryItem(item)}
                        className="flex-1 text-left"
                      >
                        <p className="text-badge font-bold text-text">{item.condition_label}</p>
                        <p className="mt-0.5 text-[12px] text-text-muted">
                          {formatJakartaDateTime(item.created_at)} • Keyakinan {confPct}%
                        </p>
                      </button>

                      <button
                        type="button"
                        aria-label={`Hapus riwayat ${item.condition_label}`}
                        disabled={deletingId === item.id}
                        onClick={() => void handleDeleteHistoryItem(item.id)}
                        className="inline-flex h-9 w-9 min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill text-text-muted hover:bg-surface hover:text-status-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2">
                      <StatusBadge urgency={item.urgency_level} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="space-y-6 lg:col-span-8">
          {report ? (
            <ScanResultCard
              report={report}
              previewUrl={previewUrl}
              onScanAgain={handleStartNewScan}
            />
          ) : isAnalyzing ? (
            <section
              role="status"
              aria-live="polite"
              className="space-y-5 rounded-card border border-border bg-surface p-8 text-center shadow-sm"
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Pratinjau foto gigi yang sedang dianalisis"
                  className="mx-auto max-h-56 rounded-card border border-border object-contain"
                />
              )}
              <div className="mx-auto h-10 w-10 animate-spin rounded-pill border-4 border-brand border-t-transparent" />
              <h2 className="text-card-title text-text">
                {LOADING_PROGRESS_STEPS[progressStepIndex]}
              </h2>
              <p className="text-badge text-text-muted">
                Mohon tunggu beberapa detik, layanan AI sedang memeriksa kondisi gigi dan gusi Anda.
              </p>
            </section>
          ) : (
            <section className="space-y-6 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
              <div
                role="note"
                aria-label="Panduan Foto Akurat"
                className="rounded-card border border-border bg-brand-soft p-4 text-badge text-text"
              >
                <strong className="font-semibold text-brand-dark">Panduan Foto Akurat: </strong>
                <span>{PHOTO_LIGHTING_GUIDE_TEXT}</span>
              </div>

              <div
                role="tablist"
                aria-label="Pilih metode pengambilan foto"
                className="grid grid-cols-2 gap-3"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'camera'}
                  onClick={() => {
                    setActiveTab('camera');
                    resetFileInput();
                  }}
                  className={[
                    'inline-flex h-10 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold transition-colors',
                    activeTab === 'camera'
                      ? 'border-brand bg-brand text-surface shadow-sm'
                      : 'border-border bg-surface text-text hover:bg-brand-soft',
                  ].join(' ')}
                >
                  <Camera className="h-4 w-4 shrink-0" />
                  <span>Gunakan Kamera</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'upload'}
                  onClick={() => {
                    setActiveTab('upload');
                    resetFileInput();
                  }}
                  className={[
                    'inline-flex h-10 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold transition-colors',
                    activeTab === 'upload'
                      ? 'border-brand bg-brand text-surface shadow-sm'
                      : 'border-border bg-surface text-text hover:bg-brand-soft',
                  ].join(' ')}
                >
                  <Upload className="h-4 w-4 shrink-0" />
                  <span>Unggah dari Galeri</span>
                </button>
              </div>

              <form onSubmit={(e) => void handleAnalyzeSubmit(e)} className="space-y-5" noValidate>
                {activeTab === 'camera' ? (
                  <WebcamCapture onCapture={handleCameraCapture} />
                ) : (
                  <div className="space-y-3">
                    <label
                      htmlFor="dental-image-upload"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-border bg-bg p-6 text-center transition-colors hover:border-brand hover:bg-brand-soft"
                    >
                      <span className="text-card-title font-semibold text-brand-dark">
                        Pilih atau Sertakan File Foto Gigi dari Perangkat Anda
                      </span>
                      <span className="mt-1 text-badge text-text-muted">
                        Format yang didukung: JPG, PNG, atau WEBP (maksimal 5 MB)
                      </span>
                      <input
                        ref={fileInputRef}
                        id="dental-image-upload"
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleGalleryFileChange}
                        className="sr-only"
                      />
                    </label>

                    {selectedFile && (
                      <div className="flex items-center justify-between rounded-card border border-border bg-brand-soft px-4 py-2.5 text-badge text-text">
                        <span>
                          Berkas terpilih: <strong>{selectedFile.name}</strong> (
                          {Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                        </span>
                        <button
                          type="button"
                          onClick={resetFileInput}
                          className="font-semibold text-status-red hover:underline"
                        >
                          Ganti Foto
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="user-symptoms" className="block text-badge font-semibold text-text">
                    Keluhan Singkat (Opsional)
                  </label>
                  <textarea
                    id="user-symptoms"
                    name="user_symptoms"
                    rows={3}
                    maxLength={500}
                    value={userSymptoms}
                    onChange={(e) => setUserSymptoms(e.target.value)}
                    placeholder="Contoh: Ngilu saat minum dingin atau gusi mudah berdarah saat menyikat gigi"
                    className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <p className="mt-1 text-right text-badge text-text-muted">
                    {userSymptoms.length}/500 karakter
                  </p>
                </div>

                <AppButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={!selectedFile || cooldownLeft > 0}
                  loading={isAnalyzing}
                  loadingText="Menganalisis Gambar..."
                >
                  {cooldownLeft > 0
                    ? `Tunggu ${cooldownLeft} detik...`
                    : 'Analisis Gambar Sekarang'}
                </AppButton>
              </form>
            </section>
          )}

          <MedicalDisclaimerBanner />
        </div>
      </div>
    </div>
  );
}

export default ScanWorkspace;
