import 'dotenv/config';
import path from 'path';
import express from 'express';
import { logger } from './utils/logger';
import { authRouter } from './api/auth.routes';
import { settingsRouter } from './api/settings.routes';
import { rankingRouter } from './api/ranking.routes';
import { configRouter } from './api/config.routes';
import { auditRouter } from './api/audit.routes';
import { catalogRouter } from './api/catalog.routes';
import { usersRouter } from './api/users.routes';
import { startScheduler } from './scheduler/cron';
import { runMigrations } from './db/migrate';

async function bootstrap() {
  if (process.env.DATABASE_URL) {
    await runMigrations();
  } else {
    logger.warn('DATABASE_URL tanımlı değil — DB migration atlandı');
  }

  const app  = express();
  const PORT = process.env.PORT ?? 3000;

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
  });

  app.use('/api/auth',     authRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/ranking',  rankingRouter);
  app.use('/api/configs',  configRouter);
  app.use('/api/audit',    auditRouter);
  app.use('/api/catalog',  catalogRouter);
  app.use('/api/users',    usersRouter);

  // Production'da Vite build çıktısını serve et
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  startScheduler();

  app.listen(PORT, () => {
    logger.info(`Rankify ayakta → http://localhost:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Başlatma hatası:', err);
  process.exit(1);
});
