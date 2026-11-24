export type ErrorCode =
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
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly errors?: Record<string, string[]>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
