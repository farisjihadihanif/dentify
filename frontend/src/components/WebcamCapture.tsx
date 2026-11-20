'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppButton } from './AppButton';

export type CameraFacingMode = 'environment' | 'user';

export interface WebcamCaptureProps {
  onCapture: (file: File, previewDataUrl: string) => void;
  onCameraError?: (message: string) => void;
  initialFacingMode?: CameraFacingMode;
  className?: string;
}

export const PHOTO_LIGHTING_GUIDE_TEXT =
  'Pastikan pencahayaan terang, buka mulut dengan jelas, dan bersihkan sisa makanan sebelum memotret.';

/**
 * Hentikan seluruh track pada `MediaStream` agar kamera tidak tetap menyala
 * saat pengguna berpindah halaman (`DESIGN.md §7`).
 */
export function stopMediaStreamTracks(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Abaikan bila track sudah berhenti
    }
  }
}

/**
 * Komponen kamera browser (`DESIGN.md §3.2`, `§4.4`, `§7` & `AGENTS.md › Standar UI/UX`):
 * - Menampilkan panduan pencahayaan dan kebersihan gigi sebelum pengambilan foto
 * - Mendukung pergantian kamera depan/belakang (`switch camera`), ambil foto (`capture`), dan foto ulang (`retake`)
 * - Mematikan `MediaStream` secara otomatis saat komponen di-unmount
 */
export function WebcamCapture({
  onCapture,
  onCameraError,
  initialFacingMode = 'environment',
  className = '',
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<CameraFacingMode>(initialFacingMode);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    stopMediaStreamTracks(streamRef.current);
    streamRef.current = null;
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(
    async (targetFacingMode: CameraFacingMode = facingMode) => {
      stopCamera();
      setCameraError(null);

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        const message =
          'Kamera tidak didukung pada perangkat/browser ini. Silakan gunakan tab Unggah dari Galeri.';
        setCameraError(message);
        onCameraError?.(message);
        return;
      }

      setIsStarting(true);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1024 },
            height: { ideal: 768 },
          },
          audio: false,
        });

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setIsStreaming(true);
      } catch {
        const message =
          'Izin akses kamera ditolak atau kamera sedang digunakan aplikasi lain. Anda tetap dapat mengunggah foto dari galeri.';
        setCameraError(message);
        onCameraError?.(message);
      } finally {
        setIsStarting(false);
      }
    },
    [facingMode, onCameraError, stopCamera],
  );

  useEffect(() => {
    return () => {
      stopMediaStreamTracks(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const handleSwitchCamera = async () => {
    const nextMode: CameraFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    setCapturedPreview(null);
    await startCamera(nextMode);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPreview(dataUrl);
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `denthub-capture-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file, dataUrl);
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleRetake = async () => {
    setCapturedPreview(null);
    await startCamera(facingMode);
  };

  return (
    <div className={['space-y-4', className].filter(Boolean).join(' ')}>
      <div
        role="note"
        aria-label="Panduan Foto Akurat"
        className="rounded-card border border-border bg-brand-soft p-3.5 text-badge text-text"
      >
        <strong className="font-semibold text-brand-dark">Panduan Foto Akurat: </strong>
        <span>{PHOTO_LIGHTING_GUIDE_TEXT}</span>
      </div>

      <div className="relative overflow-hidden rounded-card border border-border bg-surface">
        {capturedPreview ? (
          <img
            src={capturedPreview}
            alt="Pratinjau hasil tangkapan foto gigi"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="relative aspect-video w-full bg-bg">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-6 rounded-card border-2 border-dashed border-brand opacity-80"
            />
            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 p-4 text-center">
                <p className="max-w-md text-body text-text-muted">
                  Arahkan kamera ke area gigi di dalam bingkai panduan untuk hasil analisis yang
                  optimal.
                </p>
                <AppButton
                  variant="primary"
                  loading={isStarting}
                  loadingText="Menyalakan Kamera..."
                  onClick={() => void startCamera(facingMode)}
                >
                  Aktifkan Kamera
                </AppButton>
              </div>
            )}
          </div>
        )}
      </div>

      {cameraError && (
        <p role="alert" className="text-badge font-medium text-status-red">
          {cameraError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {capturedPreview ? (
          <AppButton variant="secondary" onClick={() => void handleRetake()}>
            Foto Ulang
          </AppButton>
        ) : (
          <>
            <AppButton
              variant="primary"
              disabled={!isStreaming}
              onClick={handleCapture}
            >
              Ambil Foto Gigi
            </AppButton>
            <AppButton
              variant="secondary"
              loading={isStarting}
              onClick={() => void handleSwitchCamera()}
            >
              Ganti Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}

export default WebcamCapture;
