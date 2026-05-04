import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware';
import { getAllConfigs, getConfigByCategoryId, upsertConfig, deleteConfig } from '../db/config.repo';

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
        'ga4Views', 'ga4Sessions', 'ga4Ctr', 'ga4ConversionRate',
      ]),
      weight:      z.number().min(0).max(100),
      direction:   z.enum(['asc', 'desc']).optional(),
      salesPeriod: z.enum(['1d', '3d', '7d', '14d', '21d', '1m', '2m', '3m']).optional(),
    }))
    .length(4)
    .refine(
      items => Math.abs(items.reduce((s, c) => s + c.weight, 0) - 100) < 0.001,
      { message: 'Ağırlık toplamı 100 olmalı' }
    ),
});

configRouter.get('/', async (req: Request, res: Response) => {
  const configs = await getAllConfigs(req.user!.userId);
  res.json(configs);
});

configRouter.get('/:categoryId', async (req: Request, res: Response) => {
  const config = await getConfigByCategoryId(req.user!.userId, req.params.categoryId);
  if (!config) { res.status(404).json({ error: 'Bulunamadı' }); return; }
  res.json(config);
});

configRouter.put('/', async (req: Request, res: Response) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const saved = await upsertConfig(req.user!.userId, parsed.data as Parameters<typeof upsertConfig>[1]);
  res.json(saved);
});

configRouter.delete('/:categoryId', async (req: Request, res: Response) => {
  const deleted = await deleteConfig(req.user!.userId, req.params.categoryId);
  if (!deleted) { res.status(404).json({ error: 'Bulunamadı' }); return; }
  res.status(204).end();
});
