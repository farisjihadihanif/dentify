'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Flashlight, FlashlightOff, RotateCcw, SwitchCamera } from 'lucide-react';
import { AppButton } from './AppButton';
import { buildCameraConstraints, supportsTorch } from '../utils/cameraSupport';

export type CameraFacingMode = 'environment' | 'user';

export interface WebcamCaptureProps {
  /** Called with the photo only after the user confirms it with "Pakai Foto". */
  onCapture: (file: File) => void;
  onCameraError?: (message: string) => void;
  initialFacingMode?: CameraFacingMode;
  className?: string;
}

export const PHOTO_LIGHTING_GUIDE_TEXT =
  'Pastikan pencahayaan terang, buka mulut dengan jelas, dan bersihkan sisa makanan sebelum memotret.';

const CAPTURE_JPEG_QUALITY = 0.95;

/**
 * Hentikan seluruh track pada `MediaStream` agar kamera tidak tetap menyala
 * saat pengguna berpindah halaman.
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

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Kamera tidak ditemukan di perangkat ini. Silakan gunakan Unggah dari Galeri.';
  }
  if (name === 'NotReadableError') {
    return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi itu lalu coba lagi, atau unggah foto dari galeri.';
  }
  return 'Izin akses kamera ditolak. Izinkan kamera di pengaturan browser, atau unggah foto dari galeri.';
}

/** Bingkai panduan: garis bibir dan deretan gigi agar mulut berada di tengah foto. */
function MouthGuideOverlay() {
  return (
    <div
      aria-hidden="true"
      data-testid="mouth-guide-overlay"
      className="pointer-events-none absolute inset-0"
    >
      <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <g fill="none" stroke="white" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.7))' }}>
          <ellipse cx="160" cy="88" rx="104" ry="62" strokeWidth="2" strokeDasharray="7 6" />
          <path d="M84 74 Q160 46 236 74" strokeWidth="1.5" opacity="0.85" />
          <path d="M84 102 Q160 130 236 102" strokeWidth="1.5" opacity="0.85" />
          <path d="M76 88 H244" strokeWidth="1" opacity="0.6" />
          {[100, 120, 140, 160, 180, 200, 220].map((x) => {
            const bend = ((x - 160) / 76) ** 2 * 14;
            return (
              <path
                key={x}
                d={`M${x} ${60 + bend} V88 M${x} 88 V${116 - bend}`}
                strokeWidth="1"
                opacity="0.6"
              />
            );
          })}
        </g>
      </svg>
      <p className="absolute inset-x-0 top-2 text-center text-xs font-semibold text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        Posisikan gigi dan gusi di dalam bingkai
      </p>
    </div>
  );
}

/**
 * Kamera langsung untuk desktop (ponsel memakai kamera bawaan, lihat `ScanWorkspace`):
 * - resolusi tertinggi yang tersedia, bingkai panduan mulut/gigi, dan senter bila didukung
 * - pratinjau dengan `Ulangi` / `Pakai Foto` sebelum foto dikirim ke form
 * - mematikan `MediaStream` secara otomatis saat komponen di-unmount
 */
export function WebcamCapture({
  onCapture,
  onCameraError,
  initialFacingMode = 'environment',
  className = '',
}: WebcamCaptureProps) {
  const shutterRef = useRef<HTMLButtonElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Increases on every start/stop; a getUserMedia answer for an older request is thrown away
  const requestRef = useRef(0);

  const [facingMode, setFacingMode] = useState<CameraFacingMode>(initialFacingMode);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [captured, setCaptured] = useState<{ file: File; url: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    requestRef.current += 1;
    stopMediaStreamTracks(streamRef.current);
    streamRef.current = null;
    setIsStreaming(false);
    setTorchSupported(false);
    setTorchOn(false);
  }, []);

  const startCamera = useCallback(
    async (targetFacingMode: CameraFacingMode) => {
      stopCamera();
      setCameraError(null);
      const requestId = requestRef.current;

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function'
      ) {
        const message =
          'Kamera tidak didukung pada perangkat/browser ini. Silakan gunakan Unggah dari Galeri.';
        setCameraError(message);
        onCameraError?.(message);
        return;
      }

      setIsStarting(true);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(
          buildCameraConstraints(targetFacingMode),
        );
        if (requestRef.current !== requestId) {
          stopMediaStreamTracks(mediaStream);
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setTorchSupported(supportsTorch(mediaStream.getVideoTracks()[0]));
        setIsStreaming(true);
      } catch (error) {
        if (requestRef.current !== requestId) return;
        const message = cameraErrorMessage(error);
        setCameraError(message);
        onCameraError?.(message);
      } finally {
        if (requestRef.current === requestId) setIsStarting(false);
      }
    },
    [onCameraError, stopCamera],
  );

  useEffect(
    () => () => {
      requestRef.current += 1;
      stopMediaStreamTracks(streamRef.current);
      streamRef.current = null;
    },
    [],
  );

  // Bring the shutter out from under the floating dock
  useEffect(() => {
    if (isStreaming) shutterRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [isStreaming]);

  const capturedUrl = captured?.url;
  useEffect(
    () => () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    },
    [capturedUrl],
  );

  const handleSwitchCamera = async () => {
    const nextMode: CameraFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    // videoWidth is 0 until the first frame arrives
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Foto gagal diambil. Silakan coba lagi.');
          return;
        }
        const file = new File([blob], `dentify-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCamera();
        setCaptured({ file, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY,
    );
  };

  const handleRetake = async () => {
    setCaptured(null);
    await startCamera(facingMode);
  };

  if (captured) {
    return (
      <div className={['space-y-4', className].filter(Boolean).join(' ')}>
        <img
          src={captured.url}
          alt="Pratinjau hasil tangkapan foto gigi"
          className="max-h-[70vh] w-full rounded-card border border-border bg-surface-navy object-contain"
        />
        <div className="grid grid-cols-2 gap-3">
          <AppButton variant="secondary" size="lg" onClick={() => void handleRetake()}>
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Ulangi</span>
          </AppButton>
          <AppButton variant="primary" size="lg" onClick={() => onCapture(captured.file)}>
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Pakai Foto</span>
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className={['space-y-4', className].filter(Boolean).join(' ')}>
      <p className="text-badge text-text-muted">{PHOTO_LIGHTING_GUIDE_TEXT}</p>

      <div
        className="relative w-full overflow-hidden rounded-card border border-border bg-surface-navy"
        style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
      >
        {/* The box takes the stream's own ratio, so what you see is what gets captured */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget;
            if (videoWidth && videoHeight) setAspectRatio(videoWidth / videoHeight);
          }}
          className="h-full w-full object-contain"
        />
        {isStreaming ? (
          <MouthGuideOverlay />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/90 p-4 text-center">
            <p className="max-w-md text-body text-text-muted">
              Arahkan kamera ke area gigi di dalam bingkai panduan untuk hasil analisis yang optimal.
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

      {cameraError && (
        <p role="alert" className="text-badge font-medium text-status-red">
          {cameraError}
        </p>
      )}

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label={`Ganti Kamera (${facingMode === 'environment' ? 'Belakang' : 'Depan'})`}
          title="Ganti Kamera"
          disabled={isStarting || !isStreaming}
          onClick={() => void handleSwitchCamera()}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text btn-motion hover:bg-brand-soft disabled:opacity-40"
        >
          <SwitchCamera className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          ref={shutterRef}
          type="button"
          aria-label="Ambil Foto Gigi"
          title="Ambil Foto Gigi"
          disabled={!isStreaming}
          onClick={handleCapture}
          className="inline-flex h-20 w-20 items-center justify-center rounded-full border-4 border-brand bg-brand text-surface shadow-md outline-none ring-4 ring-brand-soft transition-hover focus-visible:duration-press motion-safe:hover:scale-[1.03] focus-visible:ring-brand-ring motion-safe:active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
        >
          <Camera className="h-8 w-8" aria-hidden="true" />
        </button>

        {torchSupported ? (
          <button
            type="button"
            aria-label={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
            aria-pressed={torchOn}
            title="Senter"
            onClick={() => void handleToggleTorch()}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-text btn-motion hover:bg-brand-soft"
          >
            {torchOn ? (
              <FlashlightOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Flashlight className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : (
          <span className="h-12 w-12" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

export default WebcamCapture;
