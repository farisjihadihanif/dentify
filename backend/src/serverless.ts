import type { Express } from 'express';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDb } from './config/db';
import { assertProductionEnv } from './config/env';
import { ApiError } from './utils/ApiError';
import { logger } from './utils/logger';

export interface ReadinessDeps {
  connect: () => Promise<unknown>;
  assertEnv: () => void;
  isDisconnected: () => boolean;
}

/**
 * One MongoDB connection per serverless instance, shared by concurrent requests and reused by
 * later ones. A failed or dropped connection is retried on the next request.
 */
export function createReadiness(deps: ReadinessDeps): () => Promise<void> {
  let pending: Promise<void> | null = null;
  let settled = false;

  return () => {
    if (pending && settled && deps.isDisconnected()) pending = null;
    if (!pending) {
      settled = false;
      const attempt: Promise<void> = (async () => {
        try {
          deps.assertEnv();
          await deps.connect();
          settled = true;
        } catch (err) {
          pending = null;
          // Env problems name variables only; driver messages may contain the host, so log the
          // error name for those.
          logger.error('Backend not ready', {
            name: err instanceof Error ? err.name : 'UnknownError',
            reason:
              err instanceof Error && err.message.startsWith('Invalid production environment')
                ? err.message
                : undefined,
          });
          throw new ApiError(
            503,
            'SERVER_NOT_READY',
            'Server belum siap karena masalah konfigurasi atau database. Silakan coba lagi sebentar lagi.',
          );
        }
      })();
      pending = attempt;
    }
    return pending;
  };
}

/** The Express app for Vercel (api/index.js): no listen(), connection opened on first request. */
export function createServerlessApp(): Express {
  return createApp({
    ready: createReadiness({
      assertEnv: () => assertProductionEnv(),
      connect: () => connectDb(undefined, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 }),
      isDisconnected: () => mongoose.connection.readyState === 0,
    }),
  });
}
