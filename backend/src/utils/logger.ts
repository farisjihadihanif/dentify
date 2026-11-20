const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|api_key|apikey|cookie|buffer|image|avatar|mongodb_uri)/i;

function sanitizeMeta(meta: unknown): unknown {
  if (meta === null || meta === undefined) return meta;
  if (Buffer.isBuffer(meta)) return '[REDACTED_BUFFER]';
  if (Array.isArray(meta)) return meta.map(sanitizeMeta);
  if (typeof meta === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeMeta(v);
      }
    }
    return out;
  }
  return meta;
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' && level === 'INFO') {
    return;
  }
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log('INFO', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('WARN', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('ERROR', message, meta),
};
