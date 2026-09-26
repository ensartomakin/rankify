import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.middleware';
import { getAdapterForUser } from '../platform/registry';
import { tsoftCatalogDebugRouter } from '../platform/tsoft/debug.routes';
import { logger } from '../utils/logger';

export const catalogRouter = Router();
catalogRouter.use(requireAuth);
// Platforma özgü (T-Soft) hata ayıklama uçları — /debug/*
catalogRouter.use(tsoftCatalogDebugRouter);

catalogRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const adapter    = await getAdapterForUser(req.user!.userId, req.user!.tenantId);
    const categories = (await adapter.getCategories())
      .map(c => ({ categoryId: c.id, name: c.name, parentCategoryId: c.parentId }));
    logger.info(`[catalog] Kategori sayısı: ${categories.length}`);
    if (categories.length > 0) logger.info(`[catalog] İlk kategori: ${JSON.stringify(categories[0])}`);
    if (categories.length === 0) logger.warn('[catalog] Kategori listesi boş döndü');
    res.json({ categories });
  } catch (err) {
    logger.error(`Kategori listesi hatası: ${err}`);
    res.status(502).json({ error: 'Mağazadan kategori listesi alınamadı' });
  }
});




catalogRouter.get('/categories/:categoryId/products', async (req: Request, res: Response) => {
  try {
    const adapter  = await getAdapterForUser(req.user!.userId, req.user!.tenantId);
    const all      = await adapter.getProducts(req.params.categoryId);
    res.json({ products: all.slice(0, 50), total: all.length });
  } catch (err) {
    logger.error(`Kategori ürünleri hatası: ${err}`);
    res.status(502).json({ error: 'Mağazadan ürün listesi alınamadı' });
  }
});
