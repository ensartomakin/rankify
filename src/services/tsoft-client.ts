import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';
import { chunk, sleep } from '../utils/helpers';
import { getCredentials, type TsoftCredentials } from '../db/credentials.repo';
import type { TSoftProduct, TSoftSalesData, TSoftRankPayload } from '../types/tsoft';

const BATCH_SIZE  = 50;
const RATE_DELAY  = 500;
const MAX_RETRIES = 3;

// Token önbelleği — cacheKey → { token, expiresAt }
const tokenCache   = new Map<string, { token: string; expiresAt: number }>();
const tokenCacheV3 = new Map<string, { token: string; expiresAt: number }>();

async function withRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const delay = 1000 * attempt;
    logger.warn(`Retry ${attempt}/${MAX_RETRIES - 1}, ${delay}ms bekleniyor…`);
    await sleep(delay);
    return withRetry(fn, attempt + 1);
  }
}

function usernameForUrl(apiUser: string): string {
  return apiUser.includes('@') ? apiUser.split('@')[0] : apiUser;
}

// REST1 token — query params ile
async function fetchToken(http: AxiosInstance, creds: TsoftCredentials): Promise<string> {
  const username = usernameForUrl(creds.apiUser);
  const endpoint = `/rest1/auth/login/${encodeURIComponent(username)}`;
  logger.info(`[T-Soft Auth] POST ${http.defaults.baseURL}${endpoint}`);

  let res: import('axios').AxiosResponse;
  try {
    res = await http.post(endpoint, null, {
      params: { user: username, pass: creds.apiPass },
    });
  } catch (err) {
    const e = err as AxiosError;
    logger.error(`[T-Soft Auth] HTTP Error ${e.response?.status}: ${JSON.stringify(e.response?.data)}`);
    throw err;
  }

  logger.info(`[T-Soft Auth] Response ${res.status}: ${JSON.stringify(res.data)}`);

  if (!res.data?.success) {
    const textField = res.data?.message?.[0]?.text;
    const msg = Array.isArray(textField) ? textField[0] : (textField ?? 'Kimlik doğrulama başarısız');
    throw new Error(msg);
  }

  return res.data.data[0].token as string;
}

// V3 token — POST /api/v3/admin/auth/login  {email, password}
async function fetchTokenV3(http: AxiosInstance, creds: TsoftCredentials): Promise<string> {
  // apiUser tam email değilse domain'den türet
  const email = creds.apiUser.includes('@')
    ? creds.apiUser
    : `${creds.apiUser}@${new URL(creds.apiUrl).hostname.replace(/^www\./, '')}`;

  logger.info(`[T-Soft V3 Auth] POST ${http.defaults.baseURL}/api/v3/admin/auth/login email=${email}`);
  try {
    const res = await http.post('/api/v3/admin/auth/login', {
      email,
      password: creds.apiPass,
    });
    logger.info(`[T-Soft V3 Auth] Response ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
    const token = res.data?.data?.token ?? res.data?.token ?? res.data?.access_token;
    if (!token) {
      logger.warn(`[T-Soft V3 Auth] Token bulunamadı — response: ${JSON.stringify(res.data)}`);
      throw new Error('V3 token alınamadı');
    }
    return token as string;
  } catch (err) {
    const e = err as AxiosError;
    logger.error(`[T-Soft V3 Auth] Error ${e.response?.status}: ${JSON.stringify(e.response?.data).slice(0, 300)}`);
    throw err;
  }
}

async function getToken(cacheKey: string, http: AxiosInstance, creds: TsoftCredentials): Promise<string> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const token = await fetchToken(http, creds);
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 60 * 60 * 1000 });
  return token;
}

async function getTokenV3(cacheKey: string, http: AxiosInstance, creds: TsoftCredentials): Promise<string> {
  // Kalıcı API token varsa direkt kullan — 2FA flow'u atla
  if (creds.apiToken) return creds.apiToken;
  const cached = tokenCacheV3.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const token = await fetchTokenV3(http, creds);
  tokenCacheV3.set(cacheKey, { token, expiresAt: Date.now() + 60 * 60 * 1000 });
  return token;
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/rest1.*$/i, '').replace(/\/api\/v3.*$/i, '').replace(/\/$/, '');
}

// Bağlantı testi
export async function testConnection(creds: TsoftCredentials): Promise<{ ok: boolean; message: string; debug?: string }> {
  const baseUrl = normalizeBaseUrl(creds.apiUrl);
  try {
    const http = axios.create({ baseURL: baseUrl, timeout: 15_000, maxRedirects: 5 });
    await fetchToken(http, { ...creds, apiUrl: baseUrl });
    return { ok: true, message: 'Bağlantı başarılı — token alındı' };
  } catch (err) {
    const e = err as AxiosError & { message: string };
    logger.error(`[testConnection] baseUrl=${baseUrl} user=${creds.apiUser} err=${e.message}`);
    if (e.response?.status === 404) {
      return { ok: false, message: 'API adresi bulunamadı. URL\'yi kontrol edin (örn: https://markaadi.com)', debug: `baseUrl: ${baseUrl}` };
    }
    return {
      ok:      false,
      message: e.message ?? 'Bağlantı hatası',
      debug:   `baseUrl: ${baseUrl} | endpoint: /rest1/auth/login/${usernameForUrl(creds.apiUser)}`,
    };
  }
}

export class TSoftClient {
  private http:     AxiosInstance;
  private cacheKey: string;
  private creds:    TsoftCredentials;

  constructor(creds: TsoftCredentials) {
    const baseUrl = normalizeBaseUrl(creds.apiUrl);
    this.creds    = { ...creds, apiUrl: baseUrl };
    this.cacheKey = `${baseUrl}::${creds.apiUser}`;

    this.http = axios.create({ baseURL: baseUrl, timeout: 15_000, maxRedirects: 5 });
    this.http.interceptors.response.use(
      res => res,
      (err: AxiosError) => {
        logger.error(`T-Soft [${err.response?.status}] ${err.config?.url}: ${err.message}`);
        return Promise.reject(err);
      }
    );
  }

  // REST1 — token + params form-encoded POST body olarak gönderilir
  private async post<T = unknown>(endpoint: string, params: Record<string, unknown> = {}): Promise<T> {
    const token = await getToken(this.cacheKey, this.http, this.creds);
    const body  = new URLSearchParams({ token, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
    const res   = await withRetry(() =>
      this.http.post(`/rest1/${endpoint}`, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
    if (res.data?.success === false) {
      const msgText = res.data?.message?.[0]?.text;
      const msgStr  = Array.isArray(msgText) ? String(msgText[0]) : String(msgText ?? '');
      logger.info(`[REST1 ${endpoint}] success=false msg="${msgStr}"`);
      if (msgStr.toLowerCase().includes('token')) {
        tokenCache.delete(this.cacheKey);
        const newToken = await getToken(this.cacheKey, this.http, this.creds);
        const retryBody = new URLSearchParams({ token: newToken, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
        const retry    = await this.http.post(`/rest1/${endpoint}`, retryBody, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return retry.data;
      }
    }
    return res.data;
  }

  // V3 — Bearer token, GET isteği
  async getV3<T = unknown>(path: string, params: Record<string, unknown> = {}): Promise<T> {
    const token = await getTokenV3(this.cacheKey, this.http, this.creds);
    const res   = await withRetry(() =>
      this.http.get(`/api/v3/admin/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
    );
    return res.data;
  }

  async getCategories(): Promise<{ categoryId: string; name: string; parentCategoryId: string }[]> {
    return this.getCategoriesV1();
  }

  private async getCategoriesV1(): Promise<{ categoryId: string; name: string; parentCategoryId: string }[]> {
    const data = await this.post<{ success: boolean; data: Record<string, string>[] }>(
      'category/getCategories', { limit: '500' }
    );
    logger.info(`[getCategories REST1] count=${data.data?.length ?? 0} sample=${JSON.stringify(data.data?.[0]).slice(0, 200)}`);
    return (data.data ?? []).map(c => ({
      categoryId:       c.CategoryId   ?? c.categoryId   ?? '',
      name:             c.CategoryName ?? c.categoryName ?? '',
      parentCategoryId: c.ParentCode   ?? c.parentCode   ?? '0',
    })).filter(c => c.categoryId);
  }

  private flattenCategoryTree(
    node: Record<string, unknown>,
    parentId = '0',
    result: { categoryId: string; name: string; parentCategoryId: string }[] = []
  ): { categoryId: string; name: string; parentCategoryId: string }[] {
    const items = (node.data ?? node.categories ?? node.children ?? node) as unknown;
    const arr   = Array.isArray(items) ? items : [];
    for (const c of arr as Record<string, unknown>[]) {
      const id   = String(c.id ?? c.categoryId ?? c.category_id ?? '');
      const name = String(c.name ?? c.title ?? c.category_name ?? '');
      if (id) result.push({ categoryId: id, name, parentCategoryId: parentId });
      const children = c.children ?? c.sub_categories ?? c.items;
      if (Array.isArray(children) && children.length > 0) {
        this.flattenCategoryTree({ data: children }, id, result);
      }
    }
    return result;
  }

  async getCategoryProductsRawSample(categoryId: string, limit = 3): Promise<Record<string, unknown>[]> {
    const data = await this.post<{ success: boolean; data: Record<string, unknown>[] }>(
      'product/get', {
        CategoryIds:  categoryId,
        start:        '0',
        limit:        String(limit),
        FetchDetails: 'true',
        StockFields:  'true',
      }
    );
    return (data.data ?? []).slice(0, limit);
  }

  async getCategoryProducts(categoryId: string): Promise<{ productCode: string }[]> {
    const full = await this.getCategoryProductsFull(categoryId);
    return full.map(p => ({ productCode: p.productCode }));
  }

  /** Mevcut sıralamayı göstermek için — T-Soft API'nin doğal dönüş sırasını kullanır.
   *  ListNo=999999 T-Soft'un "sırasız" sentinel'ı; bu durumda API sırası siteyle örtüşür. */
  async getCategoryProductsSorted(categoryId: string): Promise<TSoftProduct[]> {
    const results: TSoftProduct[] = [];
    const rawListNos: number[] = [];
    let start = 0;
    const limit = 500;
    while (true) {
      const data = await this.post<{ success: boolean; data: Record<string, unknown>[] }>(
        'product/get', {
          CategoryIds:  categoryId,
          start:        String(start),
          limit:        String(limit),
          FetchDetails: 'true',
          StockFields:  'true',
        }
      );
      const batch = data.data ?? [];
      if (start === 0 && batch.length > 0) {
        const sample = batch.slice(0, 5).map(p => ({
          code: p.ProductCode, name: String(p.ProductName ?? '').slice(0, 30), ListNo: p.ListNo,
        }));
        logger.info(`[getCategoryProductsSorted] ilk 5: ${JSON.stringify(sample)}`);
      }
      batch.forEach(p => rawListNos.push(Number(p.ListNo ?? 999999)));
      results.push(...batch.map(p => this.mapProduct(p)));
      if (batch.length < limit) break;
      start += limit;
    }

    // 999999 dışında anlamlı ListNo'su olan ürün sayısı
    const meaningful = rawListNos.filter(n => n > 0 && n < 999999).length;
    if (meaningful > results.length * 0.5) {
      // Çoğunluk explicit sıralı → ListNo'ya göre sırala (999999'ları sona at)
      results.sort((a, b) => {
        const an = a.sortOrder < 999999 ? a.sortOrder : Infinity;
        const bn = b.sortOrder < 999999 ? b.sortOrder : Infinity;
        return an - bn;
      });
      logger.info(`[getCategoryProductsSorted] ListNo sort uygulandı — anlamlı=${meaningful}`);
    } else {
      // Çoğu 999999 → API doğal sırası siteyle örtüşür, dokunma
      logger.info(`[getCategoryProductsSorted] API doğal sırası kullanıldı — anlamlı=${meaningful}`);
    }

    logger.info(`[getCategoryProductsSorted] kategori=${categoryId} toplam=${results.length}`);
    return results;
  }

  async getCategoryProductsFull(categoryId: string): Promise<TSoftProduct[]> {
    const results: TSoftProduct[] = [];
    let start = 0;
    const limit = 500;
    while (true) {
      const data = await this.post<{ success: boolean; data: Record<string, unknown>[] }>(
        'product/get', {
          CategoryIds:  categoryId,
          start:        String(start),
          limit:        String(limit),
          FetchDetails: 'true',
          StockFields:  'true',
        }
      );
      const batch = data.data ?? [];
      results.push(...batch.map(p => this.mapProduct(p)));
      logger.info(`[getCategoryProductsFull] start=${start} dönen=${batch.length}`);
      if (batch.length < limit) break;
      start += limit;
    }
    logger.info(`[getCategoryProductsFull] kategori=${categoryId} toplam=${results.length}`);
    return results;
  }

  async getProductDetails(productCodes: string[]): Promise<TSoftProduct[]> {
    const results: TSoftProduct[] = [];
    for (const [i, batch] of chunk(productCodes, BATCH_SIZE).entries()) {
      logger.info(`Ürün detayı batch ${i + 1} (${batch.length} ürün)`);
      const data = await this.post<{ data: Record<string, unknown>[] }>(
        'product/get', {
          ProductCode:  batch.join('|'),
          FetchDetails: 'true',
          StockFields:  'true',
          limit:        String(BATCH_SIZE),
        }
      );
      const mapped = (data.data ?? []).map(p => this.mapProduct(p));
      results.push(...mapped);
      await sleep(RATE_DELAY);
    }
    return results;
  }

  private mapProduct(p: Record<string, unknown>): TSoftProduct {
    const stock = Number(p.Stock ?? p.stock ?? 0);
    // T-Soft'tan varyant verisi SubProducts veya Details altında gelebilir
    const rawVariants = (p.SubProducts ?? p.Variants ?? p.Details ?? []) as Record<string, unknown>[];
    const variants: import('../types/tsoft').TSoftVariant[] = Array.isArray(rawVariants) && rawVariants.length > 0
      ? rawVariants.map(v => ({
          variantId: String(v.ProductId ?? v.VariantId ?? v.variantId ?? ''),
          sizeName:  String(v.SizeName ?? v.VariantName ?? v.sizeName ?? ''),
          barcode:   String(v.Barcode ?? v.barcode ?? ''),
          stock:     Number(v.Stock ?? v.stock ?? 0),
          price:     Number(v.SellingPrice ?? v.price ?? 0),
        }))
      : [{ variantId: String(p.ProductId ?? ''), sizeName: 'Tek Beden', barcode: String(p.Barcode ?? ''), stock, price: Number(p.SellingPrice ?? 0) }];

    const rawImageUrl = String(
      p.MainImageUrl ?? p.mainImageUrl ?? p.ImageUrl ?? p.imageUrl ??
      p.Image        ?? p.image        ?? p.Photo    ?? p.photo    ?? ''
    );

    const listPrice    = Number(p.ListPrice ?? p.listPrice ?? p.MarketPrice ?? p.marketPrice ?? p.OldPrice ?? p.oldPrice ?? 0);
    const sellingPrice = Number(p.SellingPrice ?? p.sellingPrice ?? 0);
    const discountRate = Number(p.DiscountRate ?? p.discountRate ?? p.Discount ?? p.discount ?? 0)
      || (listPrice > 0 && sellingPrice < listPrice
          ? Math.round(((listPrice - sellingPrice) / listPrice) * 100)
          : 0);

    return {
      productId:        String(p.ProductId ?? p.productId ?? p.Id ?? p.id ?? ''),
      productCode:      String(p.ProductCode ?? p.productCode ?? ''),
      productName:      String(p.ProductName ?? p.productName ?? ''),
      categoryId:       String(p.DefaultCategoryId ?? p.CategoryId ?? p.categoryId ?? ''),
      categoryPath:     String(p.DefaultCategoryPath ?? p.categoryPath ?? ''),
      registrationDate: String(p.CreateDate ?? p.RegistrationDate ?? p.registrationDate ?? new Date().toISOString()),
      imageCount:       Number(p.ImageCount ?? p.imageCount ?? p.ImageFilesCount ?? p.imageFilesCount ?? 0),
      imageUrl:         rawImageUrl,
      sortOrder:        Number(p.SortOrder ?? p.sortOrder ?? p.ListNo ?? p.listNo ??
                               p.Sequence ?? p.sequence ?? p.DisplayOrder ?? p.displayOrder ??
                               p.SortNo ?? p.sortNo ?? 0),
      reviewCount:      Number(p.ReviewCount ?? p.reviewCount ?? p.CommentCount ?? p.commentCount ?? 0),
      variants,
      discountRate,
    };
  }

  async getSalesReport(productCodes: string[], days: number): Promise<TSoftSalesData[]> {
    // report/getSalesReport bu hesapta kapalı ("Controller is not allowed!")
    // order/get + OrderDetails ile satış verisi çekiyoruz
    return this.getSalesViaOrders(days);
  }

  private async getSalesViaReport(
    productCodes: string[], days: number, startDate: string, endDate: string
  ): Promise<TSoftSalesData[]> {
    const results: TSoftSalesData[] = [];

    for (const [i, batch] of chunk(productCodes, BATCH_SIZE).entries()) {
      logger.info(`[salesReport] batch ${i + 1} (${batch.length} ürün)`);
      const raw = await this.post<unknown>(
        'report/getSalesReport', {
          ProductCode: batch.join('|'),
          startDate, endDate,
          StartDate: startDate, EndDate: endDate, // T-Soft bazen büyük harf ister
        }
      );

      // İlk batch: TAM yanıtı logla
      if (i === 0) {
        logger.info(`[salesReport] FULL raw: ${JSON.stringify(raw).slice(0, 800)}`);
      }

      const rows = this.extractRows(raw);

      if (i === 0) {
        logger.info(`[salesReport] rows=${rows.length} first=${JSON.stringify(rows[0] ?? {}).slice(0, 300)}`);
      }

      for (const r of rows) {
        const code = String(r.ProductCode ?? r.productCode ?? r.Code ?? r.code ?? '');
        if (!code) continue;
        results.push({
          productCode: code,
          soldQuantity14Days: Number(
            r.SoldQuantity  ?? r.soldQuantity  ?? r.Quantity     ?? r.quantity     ??
            r.TotalQuantity ?? r.totalQuantity ?? r.SaleQuantity ?? r.saleQuantity ??
            r.SaleCount     ?? r.saleCount     ?? r.Count        ?? r.count        ??
            r.Piece         ?? r.piece         ?? r.TotalPiece   ?? r.totalPiece   ??
            r.SoldPiece     ?? r.soldPiece     ?? r.Adet         ?? r.adet         ??
            r.ToplamAdet    ?? r.toplamAdet    ?? 0
          ),
          revenue14Days: Number(
            r.Revenue ?? r.revenue ?? r.TotalPrice ?? r.totalPrice ?? r.Amount ?? r.amount ?? 0
          ),
        });
      }

      await sleep(RATE_DELAY);
    }

    const nonZero = results.filter(r => r.soldQuantity14Days > 0).length;
    logger.info(`[salesReport] tamamlandı — toplam=${results.length} satışlı=${nonZero}`);
    return results;
  }

  private async getSalesViaOrders(days: number): Promise<TSoftSalesData[]> {
    const endDt   = new Date();
    const startDt = new Date(Date.now() - days * 86_400_000);
    const fmt     = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

    logger.info(`[salesOrders] ${fmt(startDt)} → ${fmt(endDt)}`);

    const salesMap = new Map<string, { qty: number; revenue: number }>();
    let start = 0;
    const limit = 200;

    while (true) {
      const raw = await this.post<unknown>('order/get', {
        OrderDateTimeStart: fmt(startDt),
        OrderDateTimeEnd:   fmt(endDt),
        FetchProductData:   'true',
        start:              String(start),
        limit:              String(limit),
      });

      const orders = this.extractRows(raw);


      for (const order of orders) {
        const items = this.extractOrderProducts(order);
        for (const item of items) {
          const code = String(item.ProductCode ?? item.productCode ?? item.Code ?? item.code ?? '');
          if (!code) continue;
          const qty = Number(item.Quantity ?? item.quantity ?? item.Piece ?? item.piece ?? item.Count ?? 1);
          const revenue = Number(item.TotalPrice ?? item.totalPrice ?? item.Price ?? item.price ?? 0);
          const prev = salesMap.get(code) ?? { qty: 0, revenue: 0 };
          salesMap.set(code, { qty: prev.qty + qty, revenue: prev.revenue + revenue });
        }
      }

      logger.info(`[salesOrders] start=${start} dönen=${orders.length}`);
      if (orders.length < limit) break;
      start += limit;
      await sleep(RATE_DELAY);
    }

    const results: TSoftSalesData[] = Array.from(salesMap.entries()).map(([code, s]) => ({
      productCode:        code,
      soldQuantity14Days: s.qty,
      revenue14Days:      s.revenue,
    }));

    const nonZero = results.filter(r => r.soldQuantity14Days > 0).length;
    logger.info(`[salesOrders] tamamlandı — ${results.length} ürün, ${nonZero} satışlı`);
    return results;
  }

  private extractOrderProducts(order: Record<string, unknown>): Record<string, unknown>[] {
    const candidates = [
      order.OrderDetails, order.orderDetails,   // T-Soft REST1 — gerçek alan adı
      order.Products, order.products,
      order.OrderProducts, order.orderProducts,
      order.Items, order.items,
      order.Lines, order.lines,
      order.Details, order.details,
      order.OrderLines, order.orderLines,
      order.ProductList, order.productList,
    ];
    for (const c of candidates) {
      if (Array.isArray(c) && c.length > 0) return c as Record<string, unknown>[];
    }
    return [];
  }

  /** T-Soft'un farklı yanıt formatlarından satır dizisini çıkarır */
  private extractRows(raw: unknown): Record<string, unknown>[] {
    if (Array.isArray(raw)) return raw as Record<string, unknown>[];
    if (typeof raw !== 'object' || raw === null) return [];
    const d = raw as Record<string, unknown>;
    const inner = d.data ?? d.Data ?? d.result ?? d.Result;
    if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    if (typeof inner === 'object' && inner !== null) return Object.values(inner) as Record<string, unknown>[];
    const vals = Object.values(d);
    if (vals.length > 0 && vals.every(v => typeof v === 'object' && v !== null && !Array.isArray(v))) {
      return vals as Record<string, unknown>[];
    }
    return [];
  }

  private extractMsg(res: { message?: unknown[] }): string {
    const msgText = (res.message as Record<string,unknown>[])?.[0]?.text;
    return Array.isArray(msgText) ? String(msgText[0]) : String(msgText ?? '');
  }

  getBaseUrl(): string { return this.creds.apiUrl; }

  async setKategoriSira(payload: TSoftRankPayload[]): Promise<void> {
    if (payload.length === 0) return;

    let ok = 0; let fail = 0;
    for (const item of payload) {
      try {
        const res = await this.post<{ success?: boolean; message?: unknown[] }>(
          'product/setCategorySortNumber',
          { data: JSON.stringify([{ ProductCode: item.productCode, CategoryCode: `T${item.categoryId}`, ListNo: String(item.sortOrder) }]) }
        );
        if (res?.success !== false) {
          ok++;
        } else {
          fail++;
          logger.warn(`setCategorySortNumber [${item.productCode}]: ${this.extractMsg(res)}`);
        }
      } catch (err) {
        fail++;
        logger.warn(`setCategorySortNumber hata [${item.productCode}]: ${err}`);
      }
    }
    logger.info(`SetKategoriSira tamamlandı — ${ok} başarılı, ${fail} hatalı (toplam ${payload.length})`);
  }
}

export async function getClientForUser(userId: number): Promise<TSoftClient> {
  const creds = await getCredentials(userId);
  if (!creds) throw new Error('T-Soft bağlantı bilgileri tanımlı değil. Lütfen Ayarlar sayfasından ekleyin.');
  return new TSoftClient(creds);
}
