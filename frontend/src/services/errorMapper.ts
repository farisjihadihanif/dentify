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
  | 'AI_AUTH_FAILED'
  | 'AI_SERVICE_ERROR'
  | 'SERVER_NOT_READY'
  | 'INTERNAL_ERROR'
  | 'GEOLOCATION_DENIED'
  | 'NETWORK_ERROR'
  | 'SERVER_WAKING'
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
  /** HTTP status of the response, when there was one */
  httpStatus?: number;
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
    message: 'Ukuran foto terlalu besar (maksimal 3 MB setelah dikompres). Silakan pilih foto lain.',
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
  AI_AUTH_FAILED: {
    title: 'Layanan AI menolak permintaan',
    action: 'show_alert',
    message: 'Layanan AI menolak kunci akses server. Hubungi pengelola Dentify.',
  },
  AI_SERVICE_ERROR: {
    title: 'Layanan AI mengalami kendala',
    action: 'show_retry_button',
    message: 'Layanan AI gagal memproses permintaan. Silakan coba lagi.',
  },
  SERVER_NOT_READY: {
    action: 'show_retry_button',
    message: 'Server belum siap. Silakan coba lagi sebentar lagi.',
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
  SERVER_WAKING: {
    title: 'Server sedang dinyalakan',
    action: 'show_retry_button',
    message: 'Server sedang dinyalakan, tunggu sekitar 1 menit, lalu coba lagi.',
  },
  UNKNOWN_ERROR: {
    action: 'show_alert',
    message: 'Terjadi kendala pada sistem. Silakan coba kembali beberapa saat lagi.',
  },
};

/** Codes whose backend message says more than the generic one. */
const BACKEND_MESSAGE_CODES = new Set<ApiErrorCode>([
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'FORBIDDEN',
  'NOT_FOUND',
  'AI_AUTH_FAILED',
  'AI_SERVICE_ERROR',
  'SERVER_NOT_READY',
]);

const KNOWN_CODES = new Set<string>(Object.keys(ERROR_CATALOG));

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};

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

    const status = candidate.response?.status;
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
          httpStatus: status,
        };
      }
      return {
        code: payload.code,
        ...(base.title ? { title: base.title } : {}),
        action: base.action,
        cooldownSeconds: base.cooldownSeconds,
        message:
          BACKEND_MESSAGE_CODES.has(payload.code) && payload.message ? payload.message : base.message,
        fieldErrors: payload.errors,
        httpStatus: status,
      };
    }

    // 504 is the platform's own timeout while the backend waited for the ai-service. A bare 502/503
    // is not: the ai-service's are reported by the backend as AI_SERVICE_UNAVAILABLE.
    if (status === 504) {
      return { code: 'SERVER_WAKING', ...ERROR_CATALOG.SERVER_WAKING, httpStatus: status };
    }
    if (status !== undefined) {
      const code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR');
      return {
        code,
        ...ERROR_CATALOG[code],
        ...(code === 'UNKNOWN_ERROR' && payload?.message ? { message: payload.message } : {}),
        httpStatus: status,
      };
    }
    // Network errors and timeouts: the browser got no readable answer at all
    if (!candidate.response && (candidate.code === 'ECONNABORTED' || candidate.code === 'ETIMEDOUT')) {
      return { code: 'SERVER_WAKING', ...ERROR_CATALOG.SERVER_WAKING };
    }
    if (!candidate.response && candidate.code === 'ERR_NETWORK') {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return offline
        ? { code: 'NETWORK_ERROR', ...ERROR_CATALOG.NETWORK_ERROR }
        : { code: 'SERVER_WAKING', ...ERROR_CATALOG.SERVER_WAKING };
    }
  }

  return { code: 'UNKNOWN_ERROR', ...ERROR_CATALOG.UNKNOWN_ERROR };
}

/**
 * Errors shown as the calm "server sedang dinyalakan" state instead of an error. The backend
 * answers AI_SERVICE_UNAVAILABLE only for network errors, timeouts and 502/503/504 from the
 * ai-service, i.e. while it wakes up; the notice checks /health to confirm.
 */
export function isServerWakingError(error: Pick<MappedUiError, 'code'>): boolean {
  return error.code === 'SERVER_WAKING' || error.code === 'AI_SERVICE_UNAVAILABLE';
}

export { ERROR_CATALOG };
