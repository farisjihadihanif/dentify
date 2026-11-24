import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getEnv, isOriginAllowed } from './config/env';
import apiRoutes from './routes/index';
import { getHealth } from './controllers/healthController';
import { notFound } from './middlewares/notFound';
import { errorHandler } from './middlewares/errorHandler';
import { ApiError } from './utils/ApiError';

export interface CreateAppOptions {
  /** Awaited before every API request; used on Vercel to open the cached MongoDB connection. */
  ready?: () => Promise<void>;
}

export function createApp(options: CreateAppOptions = {}): Express {
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
        if (isOriginAllowed(origin, env.corsOrigins)) {
          callback(null, true);
          return;
        }
        callback(new ApiError(403, 'FORBIDDEN', 'Origin tidak diizinkan oleh kebijakan CORS.'));
      },
      credentials: true,
    }),
  );

  // Liveness probe for hosting platforms. It touches neither MongoDB nor the ai-service.
  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'alive' });
  });

  // After CORS, so the browser can read the 503 when the server is not ready
  const { ready } = options;
  if (ready) {
    app.use((_req, _res, next) => {
      ready().then(() => next(), next);
    });
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', getHealth);
  app.use('/api/v1', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
