import type { NextFunction, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import type { AuthenticatedRequest } from './rateLimiter';

/**
 * Requires an authenticated admin account (`req.user.role === 'admin'`).
 * Must be mounted after `authMiddleware`.
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Autentikasi diperlukan untuk mengakses panel admin.'));
    return;
  }
  if (req.user.role !== 'admin') {
    next(new ApiError(403, 'FORBIDDEN', 'Akses ditolak. Hanya akun admin yang dapat mengakses halaman ini.'));
    return;
  }
  next();
}
