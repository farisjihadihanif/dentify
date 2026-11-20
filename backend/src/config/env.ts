import dotenv from 'dotenv';

dotenv.config();

export interface AppEnv {
  nodeEnv: string;
  port: number;
  trustProxy: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptSaltRounds: number;
  corsOrigins: string[];
  aiServiceUrl: string;
  aiServiceApiKey: string;
  aiServiceTimeoutMs: number;
  overpassUrl: string;
  nominatimUrl: string;
  osmUserAgent: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export function getEnv(): AppEnv {
  const corsRaw = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  const corsOrigins = corsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 5000),
    trustProxy: Number(process.env.TRUST_PROXY ?? 0),
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/denthub',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me-32chars',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    bcryptSaltRounds: Math.max(10, Number(process.env.BCRYPT_SALT_ROUNDS ?? 10)),
    corsOrigins,
    aiServiceUrl: (process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/+$/, ''),
    aiServiceApiKey: (process.env.AI_SERVICE_API_KEY ?? '').trim() || 'dev-internal-key',
    aiServiceTimeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 25000),
    overpassUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
    nominatimUrl: process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org/search',
    osmUserAgent:
      process.env.OSM_USER_AGENT ?? 'DentHub/1.0 (capstone-cc26-psu285@denthub.local)',
    adminName: process.env.ADMIN_NAME ?? 'Administrator DentHub',
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
  };
}
