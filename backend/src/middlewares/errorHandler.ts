import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

interface ErrorResponseBody {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: ErrorResponseBody = {
      success: false,
      message: err.message,
      code: err.code,
    };
    if (err.code === 'VALIDATION_ERROR' && err.errors) {
      body.errors = err.errors;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        message: 'Ukuran foto maksimal 5 MB.',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    res.status(422).json({
      success: false,
      message: 'Format unggahan foto tidak valid.',
      code: 'INVALID_IMAGE',
    });
    return;
  }

  // Body parser JSON syntax error
  if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400
  ) {
    res.status(400).json({
      success: false,
      message: 'Format JSON permintaan tidak valid.',
      code: 'BAD_REQUEST',
    });
    return;
  }

  // Mongoose duplicate key error
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  ) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? 'field';
    const fieldLabel =
      field === 'email'
        ? 'Email sudah terdaftar.'
        : field === 'username'
          ? 'Username sudah digunakan.'
          : `${field} sudah digunakan.`;
    res.status(422).json({
      success: false,
      message: 'Data yang dikirim tidak valid.',
      code: 'VALIDATION_ERROR',
      errors: { [field]: [fieldLabel] },
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(err.errors)) {
      errors[key] = [val.message];
    }
    res.status(422).json({
      success: false,
      message: 'Data yang dikirim tidak valid.',
      code: 'VALIDATION_ERROR',
      errors,
    });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({
      success: false,
      message: 'Data yang diminta tidak ditemukan.',
      code: 'NOT_FOUND',
    });
    return;
  }

  logger.error('Unhandled error', {
    name: err instanceof Error ? err.name : 'UnknownError',
    message: err instanceof Error ? err.message : String(err),
  });

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan internal pada server. Silakan coba lagi beberapa saat.',
    code: 'INTERNAL_ERROR',
  });
}
