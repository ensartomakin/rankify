import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware';
import {
  upsertGa4Credentials,
  getGa4Credentials,
  hasGa4Credentials,
  deleteGa4Credentials,
  upsertGa4Metrics,
  getGa4Metrics,
  getGa4LastSync,
  getGa4PropertyId,
} from '../db/ga4.repo';
import { fetchGa4ProductMetrics, testGa4Connection } from '../services/ga4-client';
import { logger } from '../utils/logger';

export const ga4Router = Router();
ga4Router.use(requireAuth);

const credSchema = z.object({
  propertyId:         z.string().min(1, 'Property ID zorunlu'),
  serviceAccountJson: z.string().min(1, 'Servis hesabı JSON zorunlu'),
});

// GET /api/ga4/status
ga4Router.get('/status', async (req, res) => {
  try {
    const userId     = req.user!.userId;
    const configured = await hasGa4Credentials(userId);
    const lastSync   = configured ? await getGa4LastSync(userId) : null;
    const propertyId = configured ? await getGa4PropertyId(userId) : null;
    res.json({ configured, propertyId, lastSync: lastSync?.toISOString() ?? null });
  } catch (err) {
    res.status(500).json({ error: 'GA4 durum sorgusu başarısız' });
  }
});

// PUT /api/ga4/credentials
ga4Router.put('/credentials', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }
  try {
    await upsertGa4Credentials(req.user!.userId, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Kayıt başarısız' });
  }
});

// DELETE /api/ga4/credentials
ga4Router.delete('/credentials', async (req, res) => {
  try {
    await deleteGa4Credentials(req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Silme başarısız' });
  }
});

// POST /api/ga4/test
ga4Router.post('/test', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Geçersiz giriş' });
  }
  const result = await testGa4Connection(parsed.data.propertyId, parsed.data.serviceAccountJson);
  res.json(result);
});

// POST /api/ga4/sync
ga4Router.post('/sync', async (req, res) => {
  const userId    = req.user!.userId;
  const dateRange = String(req.query.dateRange ?? '30d');

  const creds = await getGa4Credentials(userId);
  if (!creds) {
    return res.status(404).json({ error: 'GA4 credentials tanımlanmamış' });
  }

  try {
    const metrics = await fetchGa4ProductMetrics(
      creds.propertyId,
      creds.serviceAccountJson,
      dateRange
    );
    await upsertGa4Metrics(userId, metrics, dateRange);
    logger.info(`[GA4 sync] userId=${userId} ${metrics.length} ürün metriği güncellendi`);
    res.json({ ok: true, count: metrics.length, dateRange });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[GA4 sync] hata userId=${userId}: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

// GET /api/ga4/metrics
ga4Router.get('/metrics', async (req, res) => {
  try {
    const userId    = req.user!.userId;
    const dateRange = String(req.query.dateRange ?? '30d');
    const map       = await getGa4Metrics(userId, dateRange);
    res.json(Object.fromEntries(map));
  } catch (err) {
    res.status(500).json({ error: 'Metrik sorgusu başarısız' });
  }
});
