import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware';
import { getAllConfigs, getConfigByCategoryId, upsertConfig, deleteConfig } from '../db/config.repo';
import { getLastRuns } from '../db/audit.repo';
import { adjustRuleSchema } from '../services/ai-instruction';

export const configRouter = Router();
configRouter.use(requireAuth);

const configSchema = z.object({
  categoryId:            z.string().min(1),
  categoryName:          z.string().optional(),
  availabilityThreshold: z.number().min(0).max(1).default(0.6),
  criteria: z
    .array(z.object({
      key: z.enum([
        'newness', 'bestSeller', 'reviewScore', 'stockScore', 'availabilityScore',
        'discountRate',
        'ga4Views', 'ga4CartAdds', 'ga4ConversionRate',
      ]),
      weight:      z.number().min(0).max(100),
      direction:   z.enum(['asc', 'desc']).optional(),
      salesPeriod: z.enum(['1d', '3d', '7d', '14d', '21d', '1m', '2m', '3m']).optional(),
    }))
    .min(3).max(5)
    .refine(
      items => Math.abs(items.reduce((s, c) => s + c.weight, 0) - 100) < 0.001,
      { message: 'Ağırlık toplamı 100 olmalı' }
    ),
  // Optional: omitted fields keep their stored value.
  smartMix:        z.boolean().optional(),
  seasonPreFilter: z.enum(['none', 'yaz-ilkbahar', 'kis-sonbahar']).optional(),
  schedule: z.object({
    isEnabled: z.boolean(),
    dayHours:  z.record(
      z.string().regex(/^[0-6]$/),
      z.array(z.number().int().min(0).max(23)).max(24)
    ),
  }).optional(),
  // AI talimatlarından üretilen kurallar ve manuel sabitlemeler (ürün kodu → sıra)
  aiRules: z.array(adjustRuleSchema).max(20).optional(),
  pins:    z.record(z.string().min(1).max(200), z.number().int().min(1).max(100000))
    .refine(p => Object.keys(p).length <= 5000, { message: 'Çok fazla sabitleme' })
    .optional(),
});

configRouter.get('/', async (req: Request, res: Response) => {
  const [configs, lastRuns] = await Promise.all([
    getAllConfigs(req.user!.userId),
    getLastRuns(req.user!.userId),
  ]);
  // lastRun: null = never run
  res.json(configs.map(c => ({ ...c, lastRun: lastRuns[c.categoryId] ?? null })));
});

configRouter.get('/:categoryId', async (req: Request, res: Response) => {
  const config = await getConfigByCategoryId(req.user!.userId, req.params.categoryId);
  if (!config) { res.status(404).json({ error: 'Bulunamadı' }); return; }
  res.json(config);
});

configRouter.put('/', async (req: Request, res: Response) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { schedule, ...rest } = parsed.data;
  const saved = await upsertConfig(req.user!.userId, {
    ...rest,
    ...(schedule && {
      schedule: {
        isEnabled: schedule.isEnabled,
        dayHours: Object.fromEntries(
          Object.entries(schedule.dayHours).map(([d, hs]) => [Number(d), [...new Set(hs)].sort((a, b) => a - b)])
        ),
      },
    }),
  } as Parameters<typeof upsertConfig>[1]);
  res.json(saved);
});

configRouter.delete('/:categoryId', async (req: Request, res: Response) => {
  const deleted = await deleteConfig(req.user!.userId, req.params.categoryId);
  if (!deleted) { res.status(404).json({ error: 'Bulunamadı' }); return; }
  res.status(204).end();
});
