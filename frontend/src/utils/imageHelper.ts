/**
 * Client-side image validation (JPEG, PNG, WEBP, GIF, BMP <= 5 MB), compression,
 * and 1:1 circular avatar frame geometry helpers.
 */

import { mapApiError, type MappedUiError } from '../services/errorMapper';

export const ALLOWED_CLIENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
] as const;
const IMAGE_EXTENSION_REGEX = /\.(jpe?g|png|webp|gif|bmp)$/i;
export const MAX_CLIENT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_MAX_IMAGE_WIDTH = 1024;

export interface ImageValidationResult {
  valid: boolean;
  error?: MappedUiError;
}

export function validateClientImageFile(
  file: Pick<File, 'type' | 'size' | 'name'> | null | undefined,
): ImageValidationResult {
  if (!file) {
    return {
      valid: false,
      error: mapApiError('INVALID_IMAGE'),
    };
  }

  const mime = (file.type || '').toLowerCase();
  const hasAllowedMime =
    ALLOWED_CLIENT_MIME_TYPES.includes(mime as (typeof ALLOWED_CLIENT_MIME_TYPES)[number]) ||
    mime.startsWith('image/');
  const hasFallbackImageExt =
    (mime === '' || mime === 'application/octet-stream') &&
    IMAGE_EXTENSION_REGEX.test(file.name || '');

  if (!hasAllowedMime && !hasFallbackImageExt) {
    return {
      valid: false,
      error: mapApiError('INVALID_IMAGE'),
    };
  }

  if (file.size <= 0 || file.size > MAX_CLIENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: mapApiError('PAYLOAD_TOO_LARGE'),
    };
  }

  return { valid: true };
}

/**
 * Kompresi ringan citra pada sisi klien menggunakan HTML5 Canvas (`maxWidth = 1024px`).
 * Apabila dijalankan di lingkungan non-browser (SSR/tes unit) atau gambar sudah kecil,
 * mengembalikan `file` asli tanpa gagal.
 */
export async function compressClientImage(
  file: File,
  maxWidth: number = DEFAULT_MAX_IMAGE_WIDTH,
  quality: number = 0.88,
): Promise<File> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return file;
  }

  // Lewati kompresi bila ukuran file sudah ringan (< 350 KB)
  if (file.size < 350 * 1024) {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;
      if (!origW || !origH || origW <= maxWidth) {
        resolve(file);
        return;
      }

      const scale = maxWidth / origW;
      const targetW = Math.round(origW * scale);
      const targetH = Math.round(origH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      const outputMime =
        file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name, { type: outputMime }));
        },
        outputMime,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Automatically resizes and compresses any image file (including > 500 KB) into a data URL
 * strictly <= maxBytes (default 450 KB) via HTML5 Canvas without rejecting large photos.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxBytes: number = 450 * 1024,
  maxDimension: number = 1280,
): Promise<string> {
  const readRawDataUrl = () =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Gagal membaca berkas gambar.'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
      reader.readAsDataURL(file);
    });

  if (
    file.type === 'image/svg+xml' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return readRawDataUrl();
  }

  const rawDataUrl = await readRawDataUrl();
  if (file.size <= maxBytes && estimateDataUrlBytes(rawDataUrl) <= maxBytes) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width || 640;
      const origH = img.naturalHeight || img.height || 640;
      let scale = Math.min(1, maxDimension / Math.max(origW, origH));
      let quality = 0.86;
      const outputMime = 'image/jpeg';

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const w = Math.max(64, Math.round(origW * scale));
        const h = Math.max(64, Math.round(origH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const candidate = canvas.toDataURL(outputMime, quality);
        if (estimateDataUrlBytes(candidate) <= maxBytes || attempt === 7) {
          resolve(candidate);
          return;
        }
        if (quality > 0.56) {
          quality = Number((quality - 0.1).toFixed(2));
        } else {
          scale *= 0.8;
        }
      }

      resolve(rawDataUrl);
    };

    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export interface AvatarFrameLayout {
  baseScale: number;
  drawW: number;
  drawH: number;
  maxShiftX: number;
  maxShiftY: number;
  left: number;
  top: number;
}

/**
 * Shared 1:1 geometry calculator used by both the 144px interactive preview
 * and the 320px canvas crop renderer so framing matches pixel-for-pixel.
 */
export function computeAvatarFrameLayout(
  containerSize: number,
  naturalWidth: number,
  naturalHeight: number,
  zoom: number,
  offsetXPercent: number,
  offsetYPercent: number,
): AvatarFrameLayout {
  const safeW = Math.max(1, naturalWidth || containerSize);
  const safeH = Math.max(1, naturalHeight || containerSize);
  const clampedZoom = Math.max(1, Math.min(2.5, zoom));
  const baseScale = Math.max(containerSize / safeW, containerSize / safeH);
  const drawW = safeW * baseScale * clampedZoom;
  const drawH = safeH * baseScale * clampedZoom;
  const maxShiftX = Math.max(0, (drawW - containerSize) / 2);
  const maxShiftY = Math.max(0, (drawH - containerSize) / 2);
  const left = (containerSize - drawW) / 2 + (offsetXPercent / 50) * maxShiftX;
  const top = (containerSize - drawH) / 2 + (offsetYPercent / 50) * maxShiftY;
  return { baseScale, drawW, drawH, maxShiftX, maxShiftY, left, top };
}

/**
 * Renders a square avatar image cropped with zoom (1.0-2.5x) and normalized pan offsets
 * (offsetX / offsetY in [-50, 50]%) into a compressed data URL <= 450 KB.
 */
export async function renderFramedAvatarDataUrl(
  imageSrc: string,
  zoom: number,
  offsetXPercent: number,
  offsetYPercent: number,
  outputSize: number = 320,
): Promise<string> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return imageSrc;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || img.width || outputSize;
      const origH = img.naturalHeight || img.height || outputSize;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      const layout = computeAvatarFrameLayout(
        outputSize,
        origW,
        origH,
        zoom,
        offsetXPercent,
        offsetYPercent,
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);
      ctx.drawImage(img, layout.left, layout.top, layout.drawW, layout.drawH);

      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}
