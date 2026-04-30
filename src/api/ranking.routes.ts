import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { runRankingPipeline, previewRanking, getCurrentRanking, applyManualRanking } from '../pipeline/orchestrator';
import { getConfigByCategoryId } from '../db/config.repo';
import { getClientForUser } from '../services/tsoft-client';
import { logger } from '../utils/logger';

export const rankingRouter = Router();
rankingRouter.use(requireAuth);

const criteriaSchema = z
  .array(z.object({
    key: z.enum([
      'newness', 'bestSeller', 'reviewScore', 'stockScore', 'availabilityScore',
      'discountRate',
      'ga4Views', 'ga4Sessions', 'ga4Ctr', 'ga4ConversionRate',
    ]),
    weight: z.number().min(0).max(100),
    direction: z.enum(['asc', 'desc']).optional(),
    salesPeriod: z.enum(['1d', '3d', '7d', '14d', '21d', '1m', '2m', '3m']).optional(),
  }))
  .length(3)
  .refine(
    items => Math.abs(items.reduce((s, c) => s + c.weight, 0) - 100) < 0.001,
    { message: 'Ağırlık toplamı 100 olmalı' }
  );

const triggerSchema = z.object({
  categoryId:            z.string().min(1),
  availabilityThreshold: z.number().min(0).max(1).default(0.6),
  criteria:              criteriaSchema,
  smartMix:              z.boolean().optional(),
});

const previewSchema = z.object({
  categoryId:            z.string().min(1),
  availabilityThreshold: z.number().min(0).max(1).optional(),
  criteria:              criteriaSchema.optional(),
  smartMix:              z.boolean().optional(),
});

const DEFAULT_CRITERIA = [
  { key: 'stockScore'  as const, weight: 34 },
  { key: 'bestSeller'  as const, weight: 33 },
  { key: 'newness'     as const, weight: 33 },
] as [{ key: 'stockScore'; weight: number }, { key: 'bestSeller'; weight: number }, { key: 'newness'; weight: number }];

// Kategorinin mevcut T-Soft sıralamasını döndürür
rankingRouter.get('/current', async (req: Request, res: Response) => {
  const { categoryId } = req.query;
  if (!categoryId || typeof categoryId !== 'string') {
    res.status(400).json({ error: 'categoryId query parametresi gerekli' });
    return;
  }
  try {
    const result = await getCurrentRanking(categoryId, req.user!.userId, req.user!.tenantId);
    res.json(result);
  } catch (err) {
    logger.error(`getCurrentRanking hatası [${categoryId}]: ${err}`);
    res.status(500).json({ error: 'Mevcut sıralama alınamadı' });
  }
});

// Fotoğraf URL debug: ham ürün alanlarını döndürür — prod'da kapalı
rankingRouter.get('/debug-product', requireSuperAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const { categoryId } = req.query;
  if (!categoryId || typeof categoryId !== 'string') {
    res.status(400).json({ error: 'categoryId query parametresi gerekli' });
    return;
  }
  try {
    const client = await getClientForUser(req.user!.userId, req.user!.tenantId);
    const apiUrl  = client.getBaseUrl();
    const rawProducts = await client.getCategoryProductsRawSample(categoryId, 3);
    // Her üründen sadece ID ve görsel ile ilgili alanları al
    const sample = rawProducts.map(p => {
      const relevant: Record<string, unknown> = { apiUrl };
      const imageKeys = ['ProductId','Id','id','productId','ProductCode','productCode',
        'ImageCount','imageCount','ImageFilesCount','imageFilesCount',
        'ImageUrl','imageUrl','ImagePath','imagePath','Image','image',
        'Images','images','MediaFiles','mediaFiles','Photos','photos'];
      for (const k of imageKeys) {
        if (p[k] !== undefined) relevant[k] = p[k];
      }
      return relevant;
    });
    res.json({ apiUrl, sample });
  } catch (err) {
    logger.error(`debug-product hatası: ${err}`);
    res.status(500).json({ error: 'Ürün debug verisi alınamadı' });
  }
});

const manualSchema = z.object({
  categoryId: z.string().min(1).max(100),
  products:   z.array(z.object({
    productCode: z.string().min(1).max(200),
    rank:        z.number().int().min(1),
  })).min(1).max(500),
});

rankingRouter.post('/manual', async (req: Request, res: Response) => {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { categoryId, products } = parsed.data;
  try {
    await applyManualRanking(categoryId, products, req.user!.userId, req.user!.tenantId);
    res.json({ success: true, count: products.length });
  } catch (err) {
    logger.error(`applyManualRanking hatası [${categoryId}]: ${err}`);
    res.status(500).json({ error: 'Manuel sıralama uygulanamadı' });
  }
});

rankingRouter.post('/trigger', (req: Request, res: Response) => {
  const parsed = triggerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const config   = parsed.data as Parameters<typeof runRankingPipeline>[0];
  const userId   = req.user!.userId;
  const tenantId = req.user!.tenantId;
  runRankingPipeline(config, 'manual', userId, tenantId).catch(err =>
    logger.error(`Manuel sıralama hatası: ${err}`)
  );
  res.status(202).json({ message: 'Sıralama başlatıldı', categoryId: config.categoryId });
});

rankingRouter.post('/trigger/:categoryId', async (req: Request, res: Response) => {
  const userId   = req.user!.userId;
  const tenantId = req.user!.tenantId;
  const config   = await getConfigByCategoryId(userId, req.params.categoryId);
  if (!config) { res.status(404).json({ error: 'Kategori konfigürasyonu bulunamadı' }); return; }

  runRankingPipeline(config, 'manual', userId, tenantId).catch(err =>
    logger.error(`Manuel sıralama hatası: ${err}`)
  );
  res.status(202).json({ message: 'Sıralama başlatıldı', categoryId: config.categoryId });
});

rankingRouter.post('/preview', async (req: Request, res: Response) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { categoryId, availabilityThreshold, criteria, smartMix } = parsed.data;
  const userId = req.user!.userId;

  try {
    let config: Parameters<typeof previewRanking>[0];

    if (criteria) {
      config = {
        categoryId,
        availabilityThreshold: availabilityThreshold ?? 0.6,
        criteria: criteria as typeof DEFAULT_CRITERIA,
        smartMix: smartMix ?? false,
      };
    } else {
      const saved = await getConfigByCategoryId(userId, categoryId);
      const base  = saved ?? { categoryId, availabilityThreshold: availabilityThreshold ?? 0.6, criteria: DEFAULT_CRITERIA };
      config = { ...base, smartMix: smartMix ?? false };
    }

    const result = await previewRanking(config, userId, req.user!.tenantId);
    res.json(result);
  } catch (err) {
    logger.error(`Preview hatası [${categoryId}]: ${err}`);
    res.status(500).json({ error: 'Önizleme hesaplaması başarısız' });
  }
});
