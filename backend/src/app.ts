import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv } from './config/env';
import apiRoutes from './routes/index';
import { getHealth } from './controllers/healthController';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/ApiError';

export function createApp(): Express {
  const app = express();
  const env = getEnv();

  if (env.trustProxy > 0) {
    app.set('trust proxy', env.trustProxy);
  }

  app.use(helmet());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow server-to-server, curl, or same-origin requests without Origin header
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, 'FORBIDDEN', 'Origin tidak diizinkan oleh kebijakan CORS.'));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '8mb' }));

  app.get('/health', getHealth);
  app.use('/api/v1', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
