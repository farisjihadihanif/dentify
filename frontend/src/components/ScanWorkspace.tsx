'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Plus, Trash2, History, Camera, RotateCcw, Upload } from 'lucide-react';
import { AppButton } from './AppButton';
import { ErrorBanner } from './ErrorBanner';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import { ScanResultCard } from './ScanResultCard';
import { StatusBadge, UnsureBadge } from './StatusBadge';
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
import { isMobileDevice } from '../utils/cameraSupport';
import { prepareImageForUpload, validateClientImageFile } from '../utils/imageHelper';

export const LOADING_PROGRESS_STEPS = [
  'Mengunggah foto…',
  'Menganalisis gigi…',
  'Menyusun rekomendasi…',
] as const;

/** After this long the ai-service is probably still waking up, so reassure the user. */
const SLOW_ANALYSIS_MS = 15000;

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
  const nativeCameraRef = useRef<HTMLInputElement | null>(null);
  // Increases per chosen photo, so a slow compression never overwrites a newer choice
  const photoRequestRef = useRef(0);

  const [activeTab, setActiveTab] = useState<CaptureSource>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [userSymptoms, setUserSymptoms] = useState('');
  const [isPreparing, setIsPreparing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
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
      setIsSlow(false);
      return undefined;
    }
    const slowTimer = window.setTimeout(() => setIsSlow(true), SLOW_ANALYSIS_MS);
    const interval = window.setInterval(() => {
      setProgressStepIndex((prev) =>
        prev < LOADING_PROGRESS_STEPS.length - 1 ? prev + 1 : prev,
      );
    }, 1100);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(slowTimer);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  useEffect(
    () => () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const resetFileInput = () => {
    photoRequestRef.current += 1;
    setIsPreparing(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    // Cleared so choosing the same file again still fires onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (nativeCameraRef.current) nativeCameraRef.current.value = '';
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

  /** Same validation and compression for gallery files, native camera photos and webcam captures. */
  const acceptPhoto = async (file: File) => {
    resetFileInput();
    setUiError(null);

    const validation = validateClientImageFile(file);
    if (!validation.valid && validation.error) {
      setUiError(validation.error);
      return;
    }

    const requestId = photoRequestRef.current;
    setIsPreparing(true);
    try {
      const prepared = await prepareImageForUpload(file);
      if (photoRequestRef.current !== requestId) return;
      setSelectedFile(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
    } catch (error) {
      if (photoRequestRef.current !== requestId) return;
      setUiError(
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError('INVALID_IMAGE'),
      );
    } finally {
      if (photoRequestRef.current === requestId) setIsPreparing(false);
    }
  };

  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void acceptPhoto(file);
  };

  const handleUseCamera = () => {
    setActiveTab('camera');
    setUiError(null);
    resetFileInput();
    if (isMobileDevice()) nativeCameraRef.current?.click();
  };

  const handleRetakePhoto = () => {
    resetFileInput();
    if (isMobileDevice()) nativeCameraRef.current?.click();
  };

  const handleAnalyzeSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!selectedFile || isAnalyzing || cooldownLeft > 0) return;

    setUiError(null);
    setIsAnalyzing(true);

    try {
      const result = await submitDentalScan({
        image: selectedFile,
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
          {(uiError.code === 'LOW_QUALITY_IMAGE' || uiError.code === 'NOT_DENTAL_IMAGE') && (
            <div
              role="note"
              data-testid="retake-guidance-card"
              className="rounded-card border border-border bg-brand-soft p-4 text-badge text-text"
            >
              <p className="font-semibold text-brand-dark">
                {uiError.code === 'NOT_DENTAL_IMAGE'
                  ? 'Tips Mengambil Foto Gigi yang Valid:'
                  : 'Tips Mengambil Ulang Foto yang Jelas:'}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-text-muted">
                <li>Arahkan kamera dekat ke area gigi dan gusi (foto close-up rongga mulut).</li>
                <li>Gunakan pencahayaan terang dan merata agar permukaan gigi terlihat jelas.</li>
                <li>Hindari mengunggah objek lain seperti tanaman, pemandangan, atau tangkapan layar.</li>
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
            <ul
              data-reveal-group
              data-reveal-async
              className="-mx-2 -mt-2 max-h-[28.5rem] space-y-2.5 overflow-y-auto px-2 pb-3 pt-2"
            >
              {historyItems.map((item) => {
                const itemKey = item.id ?? item.created_at;
                const isSelected = Boolean(item.id && report?.id === item.id);
                const confPct = Math.round(item.confidence_score * 100);
                return (
                  <li
                    key={itemKey}
                    className={[
                      'hover-card rounded-card border p-3',
                      isSelected
                        ? 'border-brand bg-brand-soft'
                        : 'border-border bg-bg hover:bg-brand-soft/60',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSelectHistoryItem(item)}
                        className="min-h-touch min-w-0 flex-1 text-left"
                      >
                        <p className="text-badge font-bold text-text">{item.condition_label}</p>
                        <p className="mt-0.5 text-[12px] text-text-muted">
                          {formatJakartaDateTime(item.created_at)}
                          {item.is_low_confidence ? '' : ` • Keyakinan ${confPct}%`}
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
                      {item.is_low_confidence ? (
                        <UnsureBadge size="sm" />
                      ) : (
                        <StatusBadge urgency={item.urgency_level} size="sm" />
                      )}
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
                {isSlow
                  ? 'Analisis lebih lama dari biasanya, bisa sampai sekitar 1 menit. Mohon jangan tutup halaman ini.'
                  : 'Mohon tunggu beberapa detik, layanan AI sedang memeriksa kondisi gigi dan gusi Anda.'}
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
                className="grid gap-3 sm:grid-cols-2"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'camera'}
                  onClick={handleUseCamera}
                  className={[
                    'inline-flex h-10 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold btn-motion',
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
                    'inline-flex h-10 min-h-cta items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold btn-motion',
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
                  <div className="space-y-3">
                    {selectedFile && previewUrl ? (
                      <>
                        <img
                          src={previewUrl}
                          alt="Pratinjau foto gigi"
                          className="max-h-[60vh] w-full rounded-card border border-border bg-bg object-contain"
                        />
                        <AppButton variant="secondary" fullWidth onClick={handleRetakePhoto}>
                          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>Ulangi</span>
                        </AppButton>
                      </>
                    ) : isPreparing ? null : isMobileDevice() ? (
                      <AppButton variant="secondary" size="lg" fullWidth onClick={handleUseCamera}>
                        <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>Buka Kamera</span>
                      </AppButton>
                    ) : (
                      <WebcamCapture onCapture={(file) => void acceptPhoto(file)} />
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label
                      htmlFor="dental-image-upload"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-border bg-bg p-6 text-center transition-colors hover:border-brand hover:bg-brand-soft"
                    >
                      <span className="text-card-title font-semibold text-text">
                        Pilih atau Sertakan File Foto Gigi dari Perangkat Anda
                      </span>
                      <span className="mt-1 text-badge text-text-muted">
                        Format: JPG, PNG, WEBP, GIF, atau BMP. Foto besar dikompres otomatis sebelum dikirim.
                      </span>
                      <input
                        ref={fileInputRef}
                        id="dental-image-upload"
                        name="image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                        onChange={handlePhotoInputChange}
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
                          className="link-underline font-semibold text-status-red"
                        >
                          Ganti Foto
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isPreparing && (
                  <p role="status" className="text-badge font-medium text-brand-dark">
                    Menyiapkan foto…
                  </p>
                )}

                {/* Phones: opens the native camera app (see handleUseCamera) */}
                <input
                  ref={nativeCameraRef}
                  data-testid="native-camera-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoInputChange}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />

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
                  disabled={!selectedFile || isPreparing || cooldownLeft > 0}
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
