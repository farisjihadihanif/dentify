import mongoose from 'mongoose';
import { getEnv } from './env';
import { logger } from '../utils/logger';

export async function connectDb(uri?: string): Promise<typeof mongoose> {
  const targetUri = uri ?? getEnv().mongodbUri;
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  const conn = await mongoose.connect(targetUri);
  logger.info('MongoDB connected');
  return conn;
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDbStatus(): 'connected' | 'connecting' | 'disconnected' {
  const state = mongoose.connection.readyState;
  if (state === 1) return 'connected';
  if (state === 2) return 'connecting';
  return 'disconnected';
}
