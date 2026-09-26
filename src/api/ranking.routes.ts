import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { runRankingPipeline, previewRanking, getCurrentRanking, applyManualRanking } from '../pipeline/orchestrator';
import { getConfigByCategoryId } from '../db/config.repo';
import { tsoftRankingDebugRouter } from '../platform/tsoft/debug.routes';
import { logger } from '../utils/logger';
import { applyAdjustRules, type AdjustRule } from '../scoring/ai-adjust';
import { parseInstructionToRules, AiInstructionError, adjustRuleSchema } from '../services/ai-instruction';

export const rankingRouter = Router();
rankingRouter.use(requireAuth);
// Platforma özgü (T-Soft) hata ayıklama uçları — /debug-*
rankingRouter.use(tsoftRankingDebugRouter);

const criteriaSchema = z
  .array(z.object({
    key: z.enum([
      'newness', 'bestSeller', 'reviewScore', 'stockScore', 'availabilityScore',
      'discountRate',
      'ga4Views', 'ga4CartAdds', 'ga4ConversionRate',
    ]),
    weight: z.number().min(0).max(100),
    direction: z.enum(['asc', 'desc']).optional(),
    salesPeriod: z.enum(['1d', '3d', '7d', '14d', '21d', '1m', '2m', '3m']).optional(),
  }))
  .min(3).max(5)
  .refine(
    items => Math.abs(items.reduce((s, c) => s + c.weight, 0) - 100) < 0.001,
    { message: 'Ağırlık toplamı 100 olmalı' }
  );

const seasonPreFilterSchema = z.enum(['none', 'yaz-ilkbahar', 'kis-sonbahar']).optional();

const triggerSchema = z.object({
  categoryId:            z.string().min(1),
  availabilityThreshold: z.number().min(0).max(1).default(0.6),
  criteria:              criteriaSchema,
  smartMix:              z.boolean().optional(),
  seasonPreFilter:       seasonPreFilterSchema,
});

const previewSchema = z.object({
  categoryId:            z.string().min(1),
  availabilityThreshold: z.number().min(0).max(1).optional(),
  criteria:              criteriaSchema.optional(),
  smartMix:              z.boolean().optional(),
  seasonPreFilter:       seasonPreFilterSchema,
});

const DEFAULT_CRITERIA = [
  { key: 'stockScore'  as const, weight: 25 },
  { key: 'bestSeller'  as const, weight: 25 },
  { key: 'newness'     as const, weight: 25 },
  { key: 'reviewScore' as const, weight: 25 },
] as [
  { key: 'stockScore';  weight: number },
  { key: 'bestSeller';  weight: number },
  { key: 'newness';     weight: number },
  { key: 'reviewScore'; weight: number },
];

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



const manualSchema = z.object({
  categoryId: z.string().min(1).max(100),
  // setKategoriSira zaten T-Soft'a 100'lük gruplar halinde (yeniden denemeli) yazıyor —
  // buradaki üst sınır sadece aşırı büyük payload'lara karşı bir güvenlik payı, T-Soft'un
  // kendisi tek istekte kaç ürün kabul ettiğini sınırlamıyor.
  products:   z.array(z.object({
    productCode: z.string().min(1).max(200),
    rank:        z.number().int().min(1),
  })).min(1).max(5000),
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
    res.status(500).json({ error: err instanceof Error ? err.message : 'Manuel sıralama uygulanamadı' });
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

  const { categoryId, availabilityThreshold, criteria, smartMix, seasonPreFilter } = parsed.data;
  const userId = req.user!.userId;

  try {
    let config: Parameters<typeof previewRanking>[0];

    if (criteria) {
      config = {
        categoryId,
        availabilityThreshold: availabilityThreshold ?? 0.6,
        criteria: criteria as typeof DEFAULT_CRITERIA,
        smartMix: smartMix ?? false,
        seasonPreFilter: seasonPreFilter ?? 'none',
      };
    } else {
      const saved = await getConfigByCategoryId(userId, categoryId);
      const base  = saved ?? { categoryId, availabilityThreshold: availabilityThreshold ?? 0.6, criteria: DEFAULT_CRITERIA };
      config = { ...base, smartMix: smartMix ?? false, seasonPreFilter: seasonPreFilter ?? 'none' };
    }

    const result = await previewRanking(config, userId, req.user!.tenantId);
    res.json(result);
  } catch (err) {
    logger.error(`Preview hatası [${categoryId}]: ${err}`);
    res.status(500).json({ error: 'Önizleme hesaplaması başarısız' });
  }
});

// AI destekli sıralama düzenleme: önizlemedeki ürünleri, doğal dil talimatına göre yeniden sıralar.
// products her zaman değişmemiş temel önizleme listesi olmalı — kurallar birikimli olarak buna uygulanır.
const adjustProductSchema = z.object({
  finalRank:      z.number(),
  productCode:    z.string().min(1),
  productName:    z.string(),
  categoryPath:   z.string().optional().default(''),
  season:         z.string().optional().default(''),
  isDisqualified: z.boolean(),
});

const aiAdjustSchema = z.object({
  categoryId:  z.string().min(1),
  products:    z.array(adjustProductSchema).min(1).max(5000),
  rules:       z.array(adjustRuleSchema).max(20).optional(),
  instruction: z.string().trim().min(1).max(500).optional(),
  // Önizleme Smart Mix ile üretildiyse true — kural uygulamaları o zaman Smart Mix'in
  // ürettiği boşlukları da yeniden sağlamaya çalışır (aksi halde aynı ürün varyantları
  // art arda gelebilir).
  smartMix:        z.boolean().optional(),
  // Önizleme bir sezon ön-sıralaması filtresiyle üretildiyse — kural uygulamaları o zaman
  // tercih edilen sezon grubunu tüketmeden diğer sezona geçmez.
  seasonPreFilter: seasonPreFilterSchema,
});

rankingRouter.post('/ai-adjust', async (req: Request, res: Response) => {
  const parsed = aiAdjustSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { products, instruction, smartMix, seasonPreFilter } = parsed.data;
  const adjustOptions = { respaceSameProduct: smartMix, seasonPreFilter };
  const existingRules: AdjustRule[] = parsed.data.rules ?? [];
  let rules: AdjustRule[] = existingRules;
  let addedRules: AdjustRule[] = [];

  try {
    if (instruction) {
      const categoryPaths = Array.from(
        new Set(products.map(p => p.categoryPath).filter((c): c is string => !!c))
      );
      // Kullanıcı "1. sıradaki ürün" derken ekranda o an GÖRDÜĞÜ sırayı kastediyor —
      // yani önceki kuralların zaten uygulanmış hali, temel (değişmemiş) liste değil.
      const currentlyDisplayed = applyAdjustRules(products, existingRules, adjustOptions);
      addedRules = await parseInstructionToRules(instruction, {
        categoryPaths,
        totalProducts: products.length,
        orderedProducts: currentlyDisplayed.map(p => ({
          finalRank: p.finalRank, productCode: p.productCode, productName: p.productName,
        })),
      });
      rules = [...rules, ...addedRules];
    }

    const reordered = applyAdjustRules(products, rules, adjustOptions);
    res.json({ products: reordered, rules, addedRules });
  } catch (err) {
    if (err instanceof AiInstructionError) {
      res.status(422).json({ error: err.message });
      return;
    }
    logger.error(`ai-adjust hatası [${parsed.data.categoryId}]: ${err}`);
    res.status(500).json({ error: 'Sıralama güncellenemedi' });
  }
});
