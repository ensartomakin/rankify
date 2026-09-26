import { getAdapterForUser } from '../platform/registry';
import type { PlatformAdapter, PlatformProduct, SalesStat } from '../platform/types';
import { computeSizeAvailability } from '../scoring/availability';
import { getGa4Credentials, getGa4Metrics, upsertGa4Metrics, getGa4LastSyncForRange } from '../db/ga4.repo';
import { fetchGa4ProductMetrics, } from '../services/ga4-client';

const GA4_KEYS         = new Set(['ga4Views','ga4CartAdds','ga4ConversionRate']);
const GA4_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat — bu sürenin ötesinde önbellek bayat sayılır

function salesPeriodToGa4Range(period?: string): string {
  switch (period) {
    case '3d':  return '3d';
    case '7d':  return '7d';
    case '14d': return '14d';
    case '21d': return '21d';
    case '1m':  return '30d';
    case '2m':  return '60d';
    case '3m':  return '90d';
    default:    return '30d';
  }
}

async function resolveGa4Map(
  config: WeightConfig,
  userId: number
): Promise<Map<string, import('../db/ga4.repo').Ga4ProductMetric>> {
  const ga4Criterion = config.criteria.find(c => GA4_KEYS.has(c.key));
  if (!ga4Criterion) return new Map();
  const dateRange = salesPeriodToGa4Range(ga4Criterion.salesPeriod);
  let map = await getGa4Metrics(userId, dateRange).catch(() => new Map());

  const lastSync = await getGa4LastSyncForRange(userId, dateRange).catch(() => null);
  const isStale  = !lastSync || (Date.now() - lastSync.getTime()) > GA4_CACHE_TTL_MS;

  if (map.size === 0 || isStale) {
    try {
      const creds = await getGa4Credentials(userId);
      if (creds) {
        const metrics = await fetchGa4ProductMetrics(creds.propertyId, creds.refreshToken, dateRange);
        await upsertGa4Metrics(userId, metrics, dateRange);
        map = new Map(metrics.map(m => [m.itemId, m]));
        logger.info(`[GA4] auto-sync ${dateRange}: ${metrics.length} ürün`);
      }
    } catch (e) {
      logger.warn(`[GA4] auto-sync başarısız: ${e}`);
      // senkronizasyon başarısız olsa bile, varsa eski (bayat) önbelleği kullanmaya devam et
    }
  }
  return map;
}

function salesPeriodToDays(period?: string): number {
  switch (period) {
    case '1d':  return 1;
    case '3d':  return 3;
    case '7d':  return 7;
    case '14d': return 14;
    case '21d': return 21;
    case '1m':  return 30;
    case '2m':  return 60;
    case '3m':  return 90;
    default:    return 14;
  }
}
import {
  applyDisqualification,
  computeRankingScores,
  buildFinalRanking,
} from '../scoring/ranker';
import { applySmartMix } from '../scoring/smart-mix';
import { isPreferredSeason } from '../scoring/season';
import { logger } from '../utils/logger';
import { sleep } from '../utils/helpers';
import { insertAuditLog } from '../db/audit.repo';
import type { WeightConfig, NormalizedProduct, CriterionKey, SeasonPreFilter } from '../types/product';

// ── Sezon ön-sıralama ────────────────────────────────────────────────────────

function applySeasonPreSort(products: NormalizedProduct[], filter: SeasonPreFilter): NormalizedProduct[] {
  if (!filter || filter === 'none') return products;

  const qualified    = products.filter(p => !p.isDisqualified);
  const disqualified = products.filter(p =>  p.isDisqualified);

  // Tercih edilen sezona uyan ve uymayan gruplar — her grubun İÇİNDE mevcut sıralama
  // (kriter puanı, stok/bulunurluk dahil tüm filtreler) aynen korunur; sadece sezon
  // eşleşmesine göre ikiye bölünür. Sezon hiçbir zaman kriter puanının yerini almaz:
  // dışlanan (isDisqualified) ürünler bu bölünmeden etkilenmeden en sonda kalır, ve
  // tercih edilen sezona uyan ama puanı düşük (örn. stoğu tükenmek üzere olan) bir ürün
  // salt sezon eşleşmesi yüzünden üst sıralara sıçramaz.
  const preferred = qualified.filter(p => isPreferredSeason(p.season, filter));
  const other     = qualified.filter(p => !isPreferredSeason(p.season, filter));

  const result = [...preferred, ...other, ...disqualified];

  return result.map((p, i) => ({ ...p, finalRank: i + 1 }));
}

export interface CurrentRankItem {
  currentRank: number;
  productId:   string;
  productCode: string;
  productName: string;
  productUrl:  string;     // absolute product page URL
  imageUrl:    string;     // first of imageUrls (kept for older clients)
  imageUrls:   string[];   // absolute, best first
  totalStock:  number;
  seoUrl:      string;     // = productUrl (kept for older clients)
}

export interface CurrentRankingResult {
  products: CurrentRankItem[];
  total:    number;
  apiUrl:   string;
  categoryExportCode: string;   // category id as the store's sort import expects it
}

export async function getCurrentRanking(
  categoryId: string,
  userId = 0,
  tenantId?: number
): Promise<CurrentRankingResult> {
  const adapter  = await getAdapterForUser(userId, tenantId);
  // Mağazanın şu an gösterdiği sıra
  const products = await adapter.getProductsInStoreOrder(categoryId);

  logger.info(`[getCurrentRanking] kategori=${categoryId} toplam=${products.length}`);

  const items: CurrentRankItem[] = products.map((p, i) => ({
    currentRank: i + 1,
    productId:   p.id,
    productCode: p.code,
    productName: p.name,
    productUrl:  p.url,
    imageUrl:    p.imageUrls[0] ?? '',
    imageUrls:   p.imageUrls,
    totalStock:  p.variants.reduce((s, v) => s + v.stock, 0),
    seoUrl:      p.url,
  }));

  return { products: items, total: items.length, apiUrl: adapter.storeUrl, categoryExportCode: adapter.exportCategoryCode(categoryId) };
}

export interface ProductPreviewItem {
  finalRank:            number;
  productId:            string;
  productCode:          string;
  productName:          string;
  categoryPath:         string;
  isDisqualified:       boolean;
  disqualifyReason?:    string;
  rankingScore:         number;
  scores:               NormalizedProduct['scores'];
  criteriaContributions: Partial<Record<CriterionKey, number>>;
  totalStock:           number;
  availabilityRate:     number;
  salesQty:             number; // seçilen salesPeriod'a göre çekilen satış adedi
  reviewCount:          number;
  discountRate:         number;
  productUrl:           string;
  seoUrl:               string; // = productUrl (kept for older clients)
  registrationDate:     string;
  imageUrl:             string; // first of imageUrls (kept for older clients)
  imageUrls:            string[];
  season:               string;
  ga4?: NormalizedProduct['ga4'];
}

export interface PreviewResult {
  products:          ProductPreviewItem[];
  total:             number;
  qualifiedCount:    number;
  disqualifiedCount: number;
  apiUrl:            string;
  categoryExportCode: string;
  criteria:          WeightConfig['criteria'];
}

/* ── Ortak adımlar: veri toplama + normalleştirme + sıralama ─────────────── */

/** Platform products → scoring model, with sales and GA4 metrics attached. */
async function loadAndScore(
  adapter: PlatformAdapter,
  products: PlatformProduct[],
  config: WeightConfig,
  userId: number,
): Promise<NormalizedProduct[]> {
  const { availabilityThreshold } = config;
  const bestSellerCriterion = config.criteria.find(c => c.key === 'bestSeller');
  const salesDays = salesPeriodToDays(bestSellerCriterion?.salesPeriod);
  const sales     = await adapter.getSales(products.map(p => p.code), salesDays);
  const salesMap  = new Map<string, SalesStat>(sales.map(s => [s.code, s]));

  // GA4 metrikleri — periyoda göre önbellekten veya auto-sync
  const ga4Map = await resolveGa4Map(config, userId);

  const normalized: NormalizedProduct[] = products.map(p => {
    const ga4 = ga4Map.get(p.id);
    return {
      productId:        p.id,
      productCode:      p.code,
      productName:      p.name,
      categoryId:       p.categoryId,
      categoryPath:     p.categoryPath,
      registrationDate: new Date(p.createdAt),
      reviewCount:      p.reviewCount,
      salesQty:         salesMap.get(p.code)?.quantity ?? 0,
      discountRate:     p.discountRate,
      isActive:         p.isActive,
      season:           p.season,
      sizeAvailability: computeSizeAvailability(p.variants, availabilityThreshold),
      ga4: ga4 ? { views: ga4.views, cartAdds: ga4.cartAdds, conversionRate: ga4.conversionRate } : undefined,
      scores: { newness: 0, bestSeller: 0, reviewScore: 0, stockScore: 0, availabilityScore: 0 },
      rankingScore:   0,
      isDisqualified: false,
      finalRank:      0,
    };
  });

  return computeRankingScores(applyDisqualification(normalized, availabilityThreshold), config);
}

/** 1) Kriter puanı → 2) Sezon gruplandırması → 3) Smart mix (en son — böylece sezon
 *  gruplandırmasının bir araya getirdiği aynı model/farklı renk ürünler arasına da
 *  Smart Mix'in araya koyduğu minimum ürün mesafesi bozulmadan uygulanır). */
function rankProducts(normalized: NormalizedProduct[], config: WeightConfig): NormalizedProduct[] {
  let ranked = buildFinalRanking(normalized);
  if (config.seasonPreFilter && config.seasonPreFilter !== 'none') {
    ranked = applySeasonPreSort(ranked, config.seasonPreFilter);
  }
  if (config.smartMix) ranked = applySmartMix(ranked);
  return ranked;
}

export async function runRankingPipeline(
  config: WeightConfig,
  triggeredBy: 'cron' | 'manual' = 'manual',
  userId = 0,
  tenantId?: number
): Promise<void> {
  const { categoryId } = config;
  const startedAt = Date.now();
  logger.info(`Pipeline başladı — kategori: ${categoryId} [${triggeredBy}]`);

  try {
    // Phase 1: Veri toplama
    const adapter  = await getAdapterForUser(userId, tenantId);
    const products = await adapter.getProducts(categoryId);

    if (products.length === 0) {
      logger.warn(`Kategoride ürün bulunamadı: ${categoryId}`);
      return;
    }

    logger.info(`${products.length} ürün bulundu, satış verileri çekiliyor… (ilk: ${products[0]?.code})`);
    const emptyCode = products.filter(p => !p.code).length;
    if (emptyCode > 0) logger.warn(`${emptyCode} üründe productCode boş`);

    // Phase 2: Normalleştirme + puanlama
    const normalized = await loadAndScore(adapter, products, config, userId);

    // Phase 3: Sıralama ve yazma
    const ranked = rankProducts(normalized, config);
    const disqualifiedCount = ranked.filter(p => p.isDisqualified).length;
    const qualifiedCount    = ranked.length - disqualifiedCount;

    // Sadece aktif ürünleri gönder — mağaza dışlananları zaten sona alır
    const toRank = ranked.filter(p => !p.isDisqualified);
    const { ok, fail } = await adapter.applySorting(
      categoryId, toRank.map((p, i) => ({ code: p.productCode, position: i + 1 }))
    );
    if (fail > 0) {
      throw new Error(`Mağaza ${fail} üründe sıralama güncellemesini reddetti (${ok} başarılı, toplam ${toRank.length})`);
    }

    const durationMs = Date.now() - startedAt;
    logger.info(`Pipeline bitti — ${qualifiedCount} aktif, ${disqualifiedCount} disqualified (${durationMs}ms)`);

    await insertAuditLog({
      userId,
      categoryId,
      triggeredBy,
      totalProducts: ranked.length,
      qualifiedCount,
      disqualifiedCount,
      durationMs,
      status: 'success',
    });

  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Pipeline hatası [${categoryId}]: ${errorMessage}`);

    await insertAuditLog({
      userId,
      categoryId,
      triggeredBy,
      totalProducts: 0,
      qualifiedCount: 0,
      disqualifiedCount: 0,
      durationMs,
      status: 'error',
      errorMessage,
    }).catch(() => {}); // audit log yazma hatasını yutma

    throw err;
  }
}

export async function previewRanking(
  config: WeightConfig,
  userId = 0,
  tenantId?: number
): Promise<PreviewResult> {
  const { categoryId } = config;
  logger.info(`Preview başladı — kategori: ${categoryId}`);

  const adapter  = await getAdapterForUser(userId, tenantId);
  const apiUrl   = adapter.storeUrl;
  const products = await adapter.getProducts(categoryId);

  if (products.length === 0) {
    return { products: [], total: 0, qualifiedCount: 0, disqualifiedCount: 0, apiUrl, categoryExportCode: adapter.exportCategoryCode(categoryId), criteria: config.criteria };
  }

  const byCode = new Map<string, PlatformProduct>(products.map(p => [p.code, p]));
  const ranked = rankProducts(await loadAndScore(adapter, products, config, userId), config);
  const qualifiedCount    = ranked.filter(p => !p.isDisqualified).length;
  const disqualifiedCount = ranked.length - qualifiedCount;

  const items: ProductPreviewItem[] = ranked.map(p => {
    const contributions: Partial<Record<CriterionKey, number>> = {};
    for (const c of config.criteria) {
      const raw = p.scores[c.key] ?? 0;
      const directed = c.direction === 'asc' ? (100 - raw) : raw;
      contributions[c.key] = (directed * c.weight) / 100;
    }
    const src = byCode.get(p.productCode);
    return {
      finalRank:             p.finalRank,
      productId:             src?.id ?? '',
      productCode:           p.productCode,
      productName:           p.productName,
      categoryPath:          p.categoryPath,
      isDisqualified:        p.isDisqualified,
      disqualifyReason:      p.disqualifyReason,
      rankingScore:          p.rankingScore,
      scores:                p.scores,
      criteriaContributions: contributions,
      totalStock:            p.sizeAvailability.totalStock,
      availabilityRate:      p.sizeAvailability.availabilityRate,
      salesQty:              p.salesQty,
      reviewCount:           p.reviewCount,
      discountRate:          p.discountRate,
      productUrl:            src?.url ?? '',
      seoUrl:                src?.url ?? '',
      registrationDate:      p.registrationDate.toISOString(),
      imageUrl:              src?.imageUrls[0] ?? '',
      imageUrls:             src?.imageUrls ?? [],
      season:                p.season,
      ga4:                   p.ga4,
    };
  });

  logger.info(`Preview bitti — ${qualifiedCount} aktif, ${disqualifiedCount} disqualified`);
  return { products: items, total: ranked.length, qualifiedCount, disqualifiedCount, apiUrl, categoryExportCode: adapter.exportCategoryCode(categoryId), criteria: config.criteria };
}

export async function applyManualRanking(
  categoryId: string,
  items: { productCode: string; rank: number }[],
  userId = 0,
  tenantId?: number
): Promise<void> {
  const adapter = await getAdapterForUser(userId, tenantId);
  const { ok, fail } = await adapter.applySorting(
    categoryId, items.map(item => ({ code: item.productCode, position: item.rank }))
  );

  if (fail > 0) {
    const errorMessage = `Mağaza ${fail} üründe sıralama güncellemesini reddetti (${ok} başarılı, toplam ${items.length})`;
    await insertAuditLog({
      userId, categoryId, triggeredBy: 'manual',
      totalProducts: items.length, qualifiedCount: ok, disqualifiedCount: 0,
      durationMs: 0, status: 'error', errorMessage,
    }).catch(() => {});
    throw new Error(errorMessage);
  }

  logger.info(`[applyManualRanking] kategori=${categoryId} ürün=${items.length}`);
  await insertAuditLog({
    userId, categoryId, triggeredBy: 'manual',
    totalProducts: items.length, qualifiedCount: items.length, disqualifiedCount: 0,
    durationMs: 0, status: 'success',
  });
}

export async function runAllCategories(
  configs: (WeightConfig & { userId?: number; tenantId?: number })[],
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<void> {
  for (const config of configs) {
    await runRankingPipeline(config, triggeredBy, config.userId ?? 0, config.tenantId);
    await sleep(2000);
  }
}
