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

/** Blank values (e.g. `PORT=` copied from .env.example) count as unset so defaults apply. */
function envValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function getEnv(): AppEnv {
  const corsRaw = envValue('CORS_ORIGINS') ?? 'http://localhost:3000';
  const corsOrigins = corsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    nodeEnv: envValue('NODE_ENV') ?? 'development',
    port: Number(envValue('PORT') ?? 5000),
    trustProxy: Number(envValue('TRUST_PROXY') ?? 0),
    mongodbUri: envValue('MONGODB_URI') ?? 'mongodb://127.0.0.1:27017/dentify',
    jwtSecret: envValue('JWT_SECRET') ?? 'dev-only-insecure-secret-change-me-32chars',
    jwtExpiresIn: envValue('JWT_EXPIRES_IN') ?? '7d',
    bcryptSaltRounds: Math.max(10, Number(envValue('BCRYPT_SALT_ROUNDS') ?? 10)),
    corsOrigins,
    aiServiceUrl: (envValue('AI_SERVICE_URL') ?? 'http://localhost:8000').replace(/\/+$/, ''),
    aiServiceApiKey: (envValue('AI_SERVICE_API_KEY') ?? '').trim() || 'dev-internal-key',
    aiServiceTimeoutMs: Number(envValue('AI_SERVICE_TIMEOUT_MS') ?? 25000),
    overpassUrl: envValue('OVERPASS_URL') ?? 'https://overpass-api.de/api/interpreter',
    nominatimUrl: envValue('NOMINATIM_URL') ?? 'https://nominatim.openstreetmap.org/search',
    osmUserAgent:
      envValue('OSM_USER_AGENT') ?? 'Dentify/1.0 (capstone-cc26-psu285@dentify.local)',
    adminName: envValue('ADMIN_NAME') ?? 'Administrator Dentify',
    adminEmail: envValue('ADMIN_EMAIL') ?? '',
    adminPassword: envValue('ADMIN_PASSWORD') ?? '',
  };
}

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-32chars';

/**
 * Names of required production variables that are missing or unsafe. In production the dev
 * fallbacks in getEnv() (local MongoDB, a public JWT secret, the dev internal key, localhost URLs)
 * must never be used silently, so the server refuses to start instead.
 */
export function findProductionEnvProblems(
  source: Record<string, string | undefined> = process.env,
): string[] {
  const problems: string[] = [];
  const value = (key: string) => (source[key] ?? '').trim();
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'CORS_ORIGINS', 'AI_SERVICE_URL', 'AI_SERVICE_API_KEY']) {
    if (!value(key)) problems.push(`${key} is not set`);
  }
  const jwt = value('JWT_SECRET');
  if (jwt && (jwt.length < 32 || jwt === DEV_JWT_SECRET)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters');
  }
  if (value('AI_SERVICE_API_KEY') === 'dev-internal-key') {
    problems.push('AI_SERVICE_API_KEY must not be the development key');
  }
  for (const key of ['AI_SERVICE_URL', 'CORS_ORIGINS']) {
    if (/localhost|127\.0\.0\.1/.test(value(key))) problems.push(`${key} points to localhost`);
  }
  return problems;
}

export function assertProductionEnv(source: Record<string, string | undefined> = process.env): void {
  if ((source.NODE_ENV ?? '') !== 'production') return;
  const problems = findProductionEnvProblems(source);
  if (problems.length > 0) {
    throw new Error(`Invalid production environment: ${problems.join('; ')}`);
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * CORS_ORIGINS entries are exact origins, or patterns with `*` standing for one DNS label
 * fragment (e.g. `https://dentify-*.vercel.app` for Vercel preview deployments).
 */
export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  return allowed.some((entry) => {
    if (!entry.includes('*')) return entry === origin;
    const pattern = escapeRegex(entry).replace(/\*/g, '[a-z0-9-]+');
    return new RegExp(`^${pattern}$`, 'i').test(origin);
  });
}
