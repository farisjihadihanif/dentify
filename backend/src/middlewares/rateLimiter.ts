import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin';
  };
  validatedQuery?: unknown;
}

export function createRateLimiter(options: {
  windowMs?: number;
  max: number;
  message?: string;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? 60 * 1000,
    limit: options.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const authReq = req as AuthenticatedRequest;
      if (authReq.user?.id) {
        return `user:${authReq.user.id}`;
      }
      return ipKeyGenerator(req.ip ?? '127.0.0.1');
    },
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message:
          options.message ??
          'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba lagi.',
        code: 'RATE_LIMITED',
      });
    },
  });
}

// API route rate limits
export const authRateLimiter = createRateLimiter({ max: 10 });
export const scanAndChatRateLimiter = createRateLimiter({ max: 20 });
export const clinicsRateLimiter = createRateLimiter({ max: 30 });
export const generalLimiter = createRateLimiter({ max: 60 });
