import jwt, { type SignOptions } from 'jsonwebtoken';
import { getEnv } from '../config/env';
import type { UserRole } from '../constants/domain';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: JwtPayload): string {
  const env = getEnv();
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const env = getEnv();
  const decoded = jwt.verify(token, env.jwtSecret);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.sub !== 'string' ||
    typeof decoded.email !== 'string' ||
    (decoded.role !== 'user' && decoded.role !== 'admin')
  ) {
    throw new Error('Invalid token payload');
  }
  return {
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
  };
}
