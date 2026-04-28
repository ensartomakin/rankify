import { Router, Request, Response } from 'express';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { getClientForUser } from '../services/tsoft-client';
import { logger } from '../utils/logger';

export const catalogRouter = Router();
catalogRouter.use(requireAuth);

catalogRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const client     = await getClientForUser(req.user!.userId);
    const categories = await client.getCategories();
    logger.info(`[catalog] Kategori sayısı: ${categories.length}`);
    if (categories.length > 0) logger.info(`[catalog] İlk kategori: ${JSON.stringify(categories[0])}`);
    if (categories.length === 0) logger.warn('[catalog] Kategori listesi boş döndü');
    res.json({ categories });
  } catch (err) {
    logger.error(`Kategori listesi hatası: ${err}`);
    const msg = err instanceof Error ? err.message : 'Kategori listesi alınamadı';
    res.status(502).json({ error: msg });
  }
});

// Ham T-Soft yanıtını döndüren debug endpoint — prod'da kapalı
catalogRouter.get('/debug/categories', requireSuperAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const client = await getClientForUser(req.user!.userId);
  const c      = client as unknown as { post: (ep: string, p: Record<string,unknown>) => Promise<unknown>; creds: { storeCode: string } };
  const results: Record<string, unknown> = {};
  for (const ep of ['Category/getCategories', 'category/getCategories', 'Category/getCategoryTree', 'category/tree/0']) {
    try {
      results[ep] = await c.post(ep, { storeCode: c.creds.storeCode, depth: 5 });
    } catch (err) {
      const e = err as import('axios').AxiosError;
      results[ep] = { error: String(err), status: e.response?.status };
    }
  }
  res.json(results);
});

catalogRouter.get('/categories/:categoryId/products', async (req: Request, res: Response) => {
  try {
    const client       = await getClientForUser(req.user!.userId);
    const productCodes = await client.getCategoryProducts(req.params.categoryId);
    if (!productCodes.length) { res.json({ products: [] }); return; }
    const codes    = productCodes.map(p => p.productCode);
    const products = await client.getProductDetails(codes.slice(0, 50));
    res.json({ products, total: productCodes.length });
  } catch (err) {
    logger.error(`Kategori ürünleri hatası: ${err}`);
    const msg = err instanceof Error ? err.message : 'Ürün listesi alınamadı';
    res.status(502).json({ error: msg });
  }
});
