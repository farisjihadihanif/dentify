import { createApp } from './app';
import { connectDb } from './config/db';
import { getEnv } from './config/env';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  const env = getEnv();
  await connectDb(env.mongodbUri);
  const app = createApp();
  app.listen(env.port, () => {
    logger.info('DentHub backend listening', { port: env.port, env: env.nodeEnv });
  });
}

start().catch((err) => {
  logger.error('Failed to start backend server', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
