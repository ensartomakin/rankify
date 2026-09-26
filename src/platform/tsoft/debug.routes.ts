/**
 * T-Soft-only debugging endpoints (raw API payloads). Mounted under the same
 * paths as before by the catalog and ranking routers; all are super-admin
 * only and several are disabled in production.
 */
import { Router, Request, Response } from 'express';
import { requireSuperAdmin } from '../../api/auth.middleware';
import { getClientForUser } from '../../services/tsoft-client';
import { logger } from '../../utils/logger';

export const tsoftCatalogDebugRouter = Router();
export const tsoftRankingDebugRouter = Router();

// Ham T-Soft yanıtını döndüren debug endpoint — prod'da kapalı
tsoftCatalogDebugRouter.get('/debug/categories', requireSuperAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const client = await getClientForUser(req.user!.userId, req.user!.tenantId);
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

// Tek ürün ham verisini döndüren debug endpoint
tsoftCatalogDebugRouter.get('/debug/product-by-code/:productCode', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const client = await getClientForUser(req.user!.userId, req.user!.tenantId);
    const raw = await (client as unknown as {
      post: (ep: string, p: Record<string, unknown>) => Promise<{ data: Record<string, unknown>[] }>
    }).post('product/get', {
      ProductCode:  req.params.productCode,
      FetchDetails: 'true',
      StockFields:  'true',
      limit:        '1',
    });
    const p = raw?.data?.[0] ?? {};
    const labelFields: Record<string, unknown> = {};
    const additionalFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) {
      if (/^Label\d+$/i.test(k)) labelFields[k] = v;
      if (/^Additional\d+$/i.test(k)) additionalFields[k] = v;
    }
    res.json({
      labelFields,
      additionalFields,
      Details: p.Details,
      allKeys: Object.keys(p),
    });
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Ham ürün alanlarını döndüren debug endpoint — sezon alanını bulmak için
tsoftCatalogDebugRouter.get('/debug/product-fields/:categoryId', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const client = await getClientForUser(req.user!.userId, req.user!.tenantId);
    const raw = await (client as unknown as { getCategoryProductsRawSample: (id: string, n: number) => Promise<Record<string, unknown>[]> })
      .getCategoryProductsRawSample(req.params.categoryId, 3);
    // Her üründen anahtar listesi + "bilgi/extra/ek/field/info" içeren tüm alanlar
    const result = raw.map(p => {
      const allKeys = Object.keys(p);
      const extraLike: Record<string, unknown> = {};
      for (const k of allKeys) {
        if (/extra|field|bilgi|detail|spec|custom|add|prop|attr|value|info|ek/i.test(k)) {
          extraLike[k] = p[k];
        }
      }
      return { allKeys, extraLike };
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// Fotoğraf URL debug: ham ürün alanlarını döndürür — prod'da kapalı
tsoftRankingDebugRouter.get('/debug-product', requireSuperAdmin, async (req: Request, res: Response) => {
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

// Sıralama debug: ham T-Soft yanıtının tüm alanlarını döndürür — prod'da kapalı
tsoftRankingDebugRouter.get('/debug-sort', requireSuperAdmin, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' }); return;
  }
  const { categoryId, limit: limitStr } = req.query;
  if (!categoryId || typeof categoryId !== 'string') {
    res.status(400).json({ error: 'categoryId query parametresi gerekli' });
    return;
  }
  const limit = Math.min(Number(limitStr) || 10, 50);
  try {
    const client = await getClientForUser(req.user!.userId, req.user!.tenantId);
    const rawProducts = await client.getCategoryProductsRawSample(categoryId, limit);
    // Sıralama ile ilgili olabilecek tüm alanları döndür
    const sample = rawProducts.map((p, i) => {
      const sortKeys = ['ListNo','listNo','SortOrder','sortOrder','Sequence','sequence',
        'DisplayOrder','displayOrder','SortNo','sortNo','OrderNo','orderNo',
        'Priority','priority','Rank','rank','Position','position',
        'CategoryOrder','categoryOrder','CategorySort','categorySort'];
      const result: Record<string, unknown> = {
        _index: i,
        ProductCode: p.ProductCode ?? p.productCode,
        ProductName: String(p.ProductName ?? p.productName ?? '').slice(0, 50),
      };
      for (const k of sortKeys) {
        if (p[k] !== undefined) result[k] = p[k];
      }
      return result;
    });
    res.json({ total: rawProducts.length, sample });
  } catch (err) {
    logger.error(`debug-sort hatası: ${err}`);
    res.status(500).json({ error: 'Sıralama debug verisi alınamadı' });
  }
});
