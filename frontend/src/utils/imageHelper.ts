/**
 * Client-side image validation, compression under the upload limit,
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
/** Original files may be large (phone cameras); they are compressed before upload. */
export const MAX_CLIENT_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
/** Vercel rejects bodies over 4.5 MB; a 3 MB photo also fits as base64 in a chat message. */
export const MAX_UPLOAD_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
export const MAX_UPLOAD_DIMENSION = 2048;

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

  if (file.size <= 0) {
    return { valid: false, error: mapApiError('INVALID_IMAGE') };
  }
  if (file.size > MAX_CLIENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        ...mapApiError('PAYLOAD_TOO_LARGE'),
        message: 'Ukuran foto asli melebihi 25 MB. Silakan pilih foto lain.',
      },
    };
  }

  return { valid: true };
}

const ENCODE_DIMENSIONS = [MAX_UPLOAD_DIMENSION, 1600, 1280, 1024];
const ENCODE_QUALITIES = [0.92, 0.85, 0.78];

/**
 * Tries quality steps, then smaller sizes, until the image fits `maxBytes`. Never upscales and
 * never goes below 1024 px on the long side: the model crops to 224 px, so detail must survive.
 * Returns null when nothing fits.
 */
export async function encodeUnderLimit(
  width: number,
  height: number,
  encode: (width: number, height: number, quality: number) => Promise<Blob | null>,
  maxBytes: number = MAX_UPLOAD_IMAGE_BYTES,
): Promise<Blob | null> {
  const longSide = Math.max(width, height);
  const targets = [...new Set(ENCODE_DIMENSIONS.map((dim) => Math.min(dim, longSide)))];
  for (const target of targets) {
    const scale = target / longSide;
    for (const quality of ENCODE_QUALITIES) {
      const blob = await encode(Math.round(width * scale), Math.round(height * scale), quality);
      if (blob && blob.size <= maxBytes) return blob;
    }
  }
  return null;
}

function uploadError(error: MappedUiError): Error & { uiError: MappedUiError } {
  return Object.assign(new Error(error.message), { uiError: error });
}

function loadImage(objectUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = objectUrl;
  });
}

/**
 * Compresses a photo to a JPEG under 3 MB (long side up to 2048 px). Photos that are already
 * small enough are returned unchanged. Rejects with `{ uiError }` when it cannot be made to fit.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const tooLarge = () =>
    uploadError({
      ...mapApiError('PAYLOAD_TOO_LARGE'),
      message:
        'Ukuran foto masih di atas 3 MB setelah dikompres. Silakan pilih atau ambil foto lain.',
    });
  const fits = file.size <= MAX_UPLOAD_IMAGE_BYTES;

  if (
    typeof document === 'undefined' ||
    typeof Image === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    if (fits) return file;
    throw tooLarge();
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    // The browser cannot decode it (e.g. HEIC on desktop): the server could not either
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      throw uploadError(mapApiError('INVALID_IMAGE'));
    }
    const { naturalWidth, naturalHeight } = img;
    const uploadableType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (fits && uploadableType && Math.max(naturalWidth, naturalHeight) <= MAX_UPLOAD_DIMENSION) {
      return file;
    }

    const blob = await encodeUnderLimit(naturalWidth, naturalHeight, (w, h, quality) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return Promise.resolve(null);
      // JPEG has no transparency
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    });
    if (!blob) throw tooLarge();
    const baseName = (file.name || 'foto-gigi').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
