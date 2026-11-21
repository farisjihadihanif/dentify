/**
 * Helper validasi berkas foto klien (`JPEG`, `PNG`, `WEBP` <= 5 MB)
 * dan kompresi sisi klien (`maxWidth: 1024px`) sesuai `ARCHITECTURE.md §8` & `API_SPECS.md §5.1`.
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
  const hasAllowedMime = ALLOWED_CLIENT_MIME_TYPES.includes(
    mime as (typeof ALLOWED_CLIENT_MIME_TYPES)[number],
  );
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
