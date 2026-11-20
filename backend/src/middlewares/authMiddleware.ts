import type { NextFunction, Response } from 'express';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthenticatedRequest } from './rateLimiter';

async function resolveBearerUser(authHeader: string): Promise<{
  id: string;
  email: string;
  role: 'user' | 'admin';
}> {
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Token autentikasi tidak valid.');
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Token autentikasi tidak valid.');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.is_active) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Akun tidak ditemukan atau tidak aktif.');
  }

  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next(new ApiError(401, 'UNAUTHENTICATED', 'Autentikasi diperlukan untuk mengakses fitur ini.'));
      return;
    }
    req.user = await resolveBearerUser(authHeader);
    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.user = undefined;
      next();
      return;
    }
    // Invalid/expired token on an optional-auth route MUST return 401 (API_SPECS §2)
    req.user = await resolveBearerUser(authHeader);
    next();
  } catch (err) {
    next(err);
  }
}
