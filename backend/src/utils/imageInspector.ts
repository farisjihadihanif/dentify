import { MIN_IMAGE_DIMENSION } from '../constants/domain';
import { ApiError } from './ApiError';

export type SupportedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/bmp';

export interface InspectedImage {
  mime_type: SupportedImageMime;
  width: number;
  height: number;
}

function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4) return null;
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buf.length && buf[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buf.length) break;
    const marker = buf[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      continue;
    }
    if (offset + 2 > buf.length) break;
    const segmentLength = buf.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buf.length) break;

    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 7 <= buf.length) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      if (width > 0 && height > 0) {
        return { width, height };
      }
      return null;
    }
    offset += segmentLength;
  }
  return null;
}

function parseWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 25) return null;

  let offset = 12;
  while (offset + 8 <= buf.length) {
    const chunkHeader = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;

    if (chunkHeader === 'VP8X' && payloadOffset + 10 <= buf.length) {
      const width = 1 + buf.readUIntLE(payloadOffset + 4, 3);
      const height = 1 + buf.readUIntLE(payloadOffset + 7, 3);
      if (width > 0 && height > 0) return { width, height };
    } else if (chunkHeader === 'VP8 ' && payloadOffset + 10 <= buf.length) {
      if (
        buf[payloadOffset + 3] === 0x9d &&
        buf[payloadOffset + 4] === 0x01 &&
        buf[payloadOffset + 5] === 0x2a
      ) {
        const width = buf.readUInt16LE(payloadOffset + 6) & 0x3fff;
        const height = buf.readUInt16LE(payloadOffset + 8) & 0x3fff;
        if (width > 0 && height > 0) return { width, height };
      }
    } else if (chunkHeader === 'VP8L' && payloadOffset + 5 <= buf.length) {
      if (buf[payloadOffset] === 0x2f) {
        const bits = buf.readUInt32LE(payloadOffset + 1);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        if (width > 0 && height > 0) return { width, height };
      }
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    if (paddedSize <= 0) break;
    offset = payloadOffset + paddedSize;
  }
  return null;
}

function parseGifDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseBmpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 26) return null;
  const width = Math.abs(buf.readInt32LE(18));
  const height = Math.abs(buf.readInt32LE(22));
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Sniffs actual binary magic headers regardless of uploaded filename extension or MIME type.
 * Supports JPEG, PNG, RIFF/WEBP, GIF, and BMP (plus delegates exotic/extended headers to Pillow in ai-service).
 */
export function inspectImageBuffer(buf: Buffer): InspectedImage {
  if (!buf || buf.length < 12) {
    throw new ApiError(
      422,
      'INVALID_IMAGE',
      'File bukan gambar yang valid. Gunakan foto berformat JPEG, PNG, atau WEBP.',
    );
  }

  let mime: SupportedImageMime | null = null;
  let dims: { width: number; height: number } | null = null;

  // JPEG magic bytes: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    mime = 'image/jpeg';
    dims = parseJpegDimensions(buf);
  }
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    mime = 'image/png';
    dims = parsePngDimensions(buf);
  }
  // WEBP magic bytes: RIFF....WEBP
  else if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    mime = 'image/webp';
    dims = parseWebpDimensions(buf);
  }
  // GIF magic bytes: GIF87a or GIF89a
  else if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') {
    mime = 'image/gif';
    dims = parseGifDimensions(buf);
  }
  // BMP magic bytes: BM
  else if (buf[0] === 0x42 && buf[1] === 0x4d) {
    mime = 'image/bmp';
    dims = parseBmpDimensions(buf);
  }

  if (!mime) {
    throw new ApiError(
      422,
      'INVALID_IMAGE',
      'File gambar tidak valid atau rusak. Gunakan foto berformat JPEG, PNG, atau WEBP.',
    );
  }

  if (dims && (dims.width < MIN_IMAGE_DIMENSION || dims.height < MIN_IMAGE_DIMENSION)) {
    throw new ApiError(
      422,
      'LOW_QUALITY_IMAGE',
      `Resolusi foto terlalu kecil (${dims.width}×${dims.height} px, minimal ${MIN_IMAGE_DIMENSION}×${MIN_IMAGE_DIMENSION} px). Ambil ulang foto dengan pencahayaan terang dan fokus pada gigi.`,
    );
  }

  return {
    mime_type: mime,
    width: dims?.width ?? 224,
    height: dims?.height ?? 224,
  };
}
