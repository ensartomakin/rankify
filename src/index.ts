import 'dotenv/config';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { authRouter } from './api/auth.routes';
import { settingsRouter } from './api/settings.routes';
import { rankingRouter } from './api/ranking.routes';
import { configRouter } from './api/config.routes';
import { auditRouter } from './api/audit.routes';
import { catalogRouter } from './api/catalog.routes';
import { usersRouter } from './api/users.routes';
import { ga4Router } from './api/ga4.routes';
import { startScheduler } from './scheduler/cron';
import { runMigrations } from './db/migrate';

// Critical secrets must be set before anything else
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET env var is missing or too short (min 32 chars)');
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  console.error('FATAL: ENCRYPTION_KEY env var is missing or too short (min 32 chars)');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.FRONTEND_URL) {
  console.error('FATAL: FRONTEND_URL must be set in production');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  logger.warn('DATABASE_URL tanımlı değil — in-memory dev store kullanılıyor, veriler kalıcı değil');
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Çok fazla istek — 15 dakika sonra tekrar deneyin' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
});

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    await runMigrations();
  }

  const app  = express();
  const PORT = process.env.PORT ?? 3000;

  // Trust the first proxy hop (Nginx/Cloudflare/Heroku) so rate limiting
  // uses the real client IP via X-Forwarded-For, not the proxy's IP.
  app.set('trust proxy', 1);

  app.use(helmet());

  const allowedOrigins = isProd
    ? [process.env.FRONTEND_URL!]
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  app.use(cookieParser());
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth',     authLimiter, authRouter);
  app.use('/api/settings', apiLimiter,  settingsRouter);
  app.use('/api/ranking',  apiLimiter,  rankingRouter);
  app.use('/api/configs',  apiLimiter,  configRouter);
  app.use('/api/audit',    apiLimiter,  auditRouter);
  app.use('/api/catalog',  apiLimiter,  catalogRouter);
  app.use('/api/users',    apiLimiter,  usersRouter);
  app.use('/api/ga4',      apiLimiter,  ga4Router);

  // Production'da Vite build çıktısını serve et
  if (isProd) {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  // Global error handler — must be last; prevents stack trace leaks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'İç sunucu hatası' });
  });

  app.listen(PORT, async () => {
    logger.info(`Rankify ayakta → http://localhost:${PORT}`);
    if (process.env.DATABASE_URL) {
      try {
        await runMigrations();
      } catch (err) {
        logger.error('Migration hatası:', err);
      }
    }
    startScheduler();
  });
}

bootstrap().catch(err => {
  console.error('Başlatma hatası:', err);
  process.exit(1);
});
