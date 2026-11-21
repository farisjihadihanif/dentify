/**
 * Centralized API error code -> Indonesian UI message & action mapper
 *.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'INVALID_IMAGE'
  | 'LOW_QUALITY_IMAGE'
  | 'NOT_DENTAL_IMAGE'
  | 'RATE_LIMITED'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'GEOLOCATION_DENIED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export type ErrorUiAction =
  | 'redirect_login'
  | 'reset_file_input'
  | 'show_retake_guidance'
  | 'cooldown_submit_10s'
  | 'show_retry_button'
  | 'show_manual_location_form'
  | 'show_alert';

export interface MappedUiError {
  code: ApiErrorCode;
  title?: string;
  message: string;
  action: ErrorUiAction;
  cooldownSeconds?: number;
  fieldErrors?: Record<string, string[]>;
}

export interface BackendErrorPayload {
  success?: false;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

const ERROR_CATALOG: Record<ApiErrorCode, Omit<MappedUiError, 'code' | 'fieldErrors'>> = {
  UNAUTHENTICATED: {
    action: 'redirect_login',
    message: 'Sesi Anda telah berakhir. Silakan masuk kembali untuk mengakses riwayat Anda.',
  },
  PAYLOAD_TOO_LARGE: {
    action: 'reset_file_input',
    message: 'Ukuran foto terlalu besar (maksimal 5 MB). Silakan pilih foto lain.',
  },
  INVALID_IMAGE: {
    action: 'reset_file_input',
    message: 'Format file tidak didukung. Gunakan foto berformat JPG, PNG, atau WEBP.',
  },
  LOW_QUALITY_IMAGE: {
    action: 'show_retake_guidance',
    message:
      'Foto kurang jelas atau terlalu gelap. Ambil ulang foto di tempat yang terang dengan gigi yang bersih.',
  },
  NOT_DENTAL_IMAGE: {
    title: 'Bukan Foto Gigi yang Valid',
    action: 'show_retake_guidance',
    message:
      'Foto yang diunggah bukan foto gigi atau rongga mulut. Unggah foto close-up area gigi dan gusi yang terlihat jelas untuk memulai pemindaian.',
  },
  RATE_LIMITED: {
    action: 'cooldown_submit_10s',
    cooldownSeconds: 10,
    message: 'Permintaan terlalu cepat. Mohon tunggu sebentar sebelum mencoba lagi.',
  },
  AI_SERVICE_UNAVAILABLE: {
    action: 'show_retry_button',
    message: 'Layanan analisis AI sedang sibuk. Silakan kirim ulang foto Anda.',
  },
  GEOLOCATION_DENIED: {
    action: 'show_manual_location_form',
    message:
      'Akses lokasi dinonaktifkan. Masukkan nama kota atau kecamatan Anda untuk mencari klinik terdekat.',
  },
  BAD_REQUEST: {
    action: 'show_alert',
    message: 'Permintaan tidak valid. Periksa kembali data yang Anda masukkan.',
  },
  FORBIDDEN: {
    action: 'show_alert',
    message: 'Anda tidak memiliki hak akses untuk membuka halaman atau data ini.',
  },
  NOT_FOUND: {
    action: 'show_alert',
    message: 'Data yang Anda cari tidak ditemukan.',
  },
  VALIDATION_ERROR: {
    action: 'show_alert',
    message: 'Beberapa isian belum sesuai. Mohon periksa kembali formulir Anda.',
  },
  INTERNAL_ERROR: {
    action: 'show_retry_button',
    message: 'Terjadi kendala pada server. Silakan coba beberapa saat lagi.',
  },
  NETWORK_ERROR: {
    action: 'show_retry_button',
    message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
  },
  UNKNOWN_ERROR: {
    action: 'show_alert',
    message: 'Terjadi kendala pada sistem. Silakan coba kembali beberapa saat lagi.',
  },
};

const KNOWN_CODES = new Set<string>(Object.keys(ERROR_CATALOG));

function isKnownErrorCode(code: string | undefined): code is ApiErrorCode {
  return Boolean(code && KNOWN_CODES.has(code));
}

export function mapApiError(errorOrPayload: unknown): MappedUiError {
  if (typeof errorOrPayload === 'string') {
    const code: ApiErrorCode = isKnownErrorCode(errorOrPayload) ? errorOrPayload : 'UNKNOWN_ERROR';
    return { code, ...ERROR_CATALOG[code] };
  }

  if (errorOrPayload && typeof errorOrPayload === 'object') {
    const candidate = errorOrPayload as {
      code?: string | number;
      message?: string;
      errors?: Record<string, string[]>;
      response?: { status?: number; data?: BackendErrorPayload };
    };

    if (candidate.code === 1 || candidate.code === 'GEOLOCATION_DENIED') {
      return { code: 'GEOLOCATION_DENIED', ...ERROR_CATALOG.GEOLOCATION_DENIED };
    }

    const payload: BackendErrorPayload | undefined =
      candidate.response?.data ??
      (typeof candidate.code === 'string' && KNOWN_CODES.has(candidate.code)
        ? (candidate as BackendErrorPayload)
        : undefined);

    if (payload && isKnownErrorCode(payload.code)) {
      const base = ERROR_CATALOG[payload.code];
      if (
        payload.code === 'UNAUTHENTICATED' &&
        payload.message === 'Email atau password salah.'
      ) {
        return {
          code: 'UNAUTHENTICATED',
          action: 'show_alert',
          message: payload.message,
        };
      }
      return {
        code: payload.code,
        ...(base.title ? { title: base.title } : {}),
        action: base.action,
        cooldownSeconds: base.cooldownSeconds,
        message:
          payload.code === 'VALIDATION_ERROR' && payload.message ? payload.message : base.message,
        fieldErrors: payload.errors,
      };
    }

    if (candidate.response?.status === 401) {
      return { code: 'UNAUTHENTICATED', ...ERROR_CATALOG.UNAUTHENTICATED };
    }
    if (candidate.response?.status === 413) {
      return { code: 'PAYLOAD_TOO_LARGE', ...ERROR_CATALOG.PAYLOAD_TOO_LARGE };
    }
    if (candidate.response?.status === 429) {
      return { code: 'RATE_LIMITED', ...ERROR_CATALOG.RATE_LIMITED };
    }
    if (candidate.response?.status === 502) {
      return { code: 'AI_SERVICE_UNAVAILABLE', ...ERROR_CATALOG.AI_SERVICE_UNAVAILABLE };
    }

    if (!candidate.response && candidate.code === 'ERR_NETWORK') {
      return { code: 'NETWORK_ERROR', ...ERROR_CATALOG.NETWORK_ERROR };
    }
  }

  return { code: 'UNKNOWN_ERROR', ...ERROR_CATALOG.UNKNOWN_ERROR };
}

export { ERROR_CATALOG };
