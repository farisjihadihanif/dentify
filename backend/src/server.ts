import { createApp } from './app';
import { connectDb } from './config/db';
import { assertProductionEnv, getEnv } from './config/env';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  assertProductionEnv();
  const env = getEnv();
  await connectDb(env.mongodbUri);
  const app = createApp();
  app.listen(env.port, () => {
    logger.info('Dentify backend listening', { port: env.port, env: env.nodeEnv });
  });
}

start().catch((err) => {
  logger.error('Failed to start backend server', {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
