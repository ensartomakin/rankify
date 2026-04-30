import { getClientForUser } from '../services/tsoft-client';
import { computeSizeAvailability } from '../scoring/availability';
import { getGa4Credentials, getGa4Metrics, upsertGa4Metrics } from '../db/ga4.repo';
import { fetchGa4ProductMetrics, } from '../services/ga4-client';

const GA4_KEYS = new Set(['ga4Views','ga4Sessions','ga4Ctr','ga4ConversionRate']);

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
  if (map.size === 0) {
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
import { logger } from '../utils/logger';
import { sleep } from '../utils/helpers';
import { insertAuditLog } from '../db/audit.repo';
import type { WeightConfig, NormalizedProduct, CriterionKey } from '../types/product';
import type { TSoftProduct, TSoftSalesData } from '../types/tsoft';

export interface CurrentRankItem {
  currentRank: number;
  productId:   string;
  productCode: string;
  productName: string;
  imageUrl:    string;
  totalStock:  number;
  seoUrl:      string;
}

export interface CurrentRankingResult {
  products: CurrentRankItem[];
  total:    number;
  apiUrl:   string;
}

export async function getCurrentRanking(
  categoryId: string,
  userId = 0,
  tenantId?: number
): Promise<CurrentRankingResult> {
  const client   = await getClientForUser(userId, tenantId);
  const apiUrl   = client.getBaseUrl();
  // T-Soft'un ListNo'ya göre sıralanmış ürünlerini iste
  const products = await client.getCategoryProductsSorted(categoryId);

  logger.info(`[getCurrentRanking] kategori=${categoryId} toplam=${products.length}`);

  const items: CurrentRankItem[] = products.map((p, i) => ({
    currentRank: i + 1,
    productId:   p.productId,
    productCode: p.productCode,
    productName: p.productName,
    imageUrl:    p.imageUrl,
    totalStock:  p.variants.reduce((s, v) => s + v.stock, 0),
    seoUrl:      p.seoUrl,
  }));

  return { products: items, total: items.length, apiUrl };
}

export interface ProductPreviewItem {
  finalRank:            number;
  productId:            string;
  productCode:          string;
  productName:          string;
  isDisqualified:       boolean;
  disqualifyReason?:    string;
  rankingScore:         number;
  scores:               NormalizedProduct['scores'];
  criteriaContributions: Partial<Record<CriterionKey, number>>;
  totalStock:           number;
  availabilityRate:     number;
  sales14Days:          number;
  reviewCount:          number;
  discountRate:         number;
  seoUrl:               string;
  registrationDate:     string;
  imageCount:           number;
  imageUrl:             string;
  ga4?: NormalizedProduct['ga4'];
}

export interface PreviewResult {
  products:          ProductPreviewItem[];
  total:             number;
  qualifiedCount:    number;
  disqualifiedCount: number;
  apiUrl:            string;
  criteria:          WeightConfig['criteria'];
}

export async function runRankingPipeline(
  config: WeightConfig,
  triggeredBy: 'cron' | 'manual' = 'manual',
  userId = 0,
  tenantId?: number
): Promise<void> {
  const { categoryId, availabilityThreshold } = config;
  const startedAt = Date.now();
  logger.info(`Pipeline başladı — kategori: ${categoryId} [${triggeredBy}]`);

  try {
    // Phase 1: Veri toplama
    const client   = await getClientForUser(userId, tenantId);
    const products = await client.getCategoryProductsFull(categoryId);

    if (products.length === 0) {
      logger.warn(`Kategoride ürün bulunamadı: ${categoryId}`);
      return;
    }

    logger.info(`${products.length} ürün bulundu, satış verileri çekiliyor… (ilk: ${products[0]?.productCode})`);
    const emptyCode = products.filter(p => !p.productCode).length;
    if (emptyCode > 0) logger.warn(`${emptyCode} üründe productCode boş`);
    const productCodes = products.map(p => p.productCode);
    const bestSellerCriterion = config.criteria.find(c => c.key === 'bestSeller');
    const salesDays = salesPeriodToDays(bestSellerCriterion?.salesPeriod);
    const salesData    = await client.getSalesReport(productCodes, salesDays);

    // GA4 metrikleri — periyoda göre önbellekten veya auto-sync
    const ga4Map = await resolveGa4Map(config, userId);

    // Phase 2: Normalleştirme
    const salesMap = new Map<string, TSoftSalesData>(
      salesData.map(s => [s.productCode, s])
    );

    let normalized: NormalizedProduct[] = products.map((p: TSoftProduct) => {
      const sales = salesMap.get(p.productCode);
      const sizeAvailability = computeSizeAvailability(p.variants, availabilityThreshold);
      const ga4 = ga4Map.get(p.productId) ?? ga4Map.get(p.productCode);

      return {
        productId:        p.productId,
        productCode:      p.productCode,
        productName:      p.productName,
        categoryId:       p.categoryId,
        registrationDate: new Date(p.registrationDate),
        reviewCount:      p.reviewCount,
        sales14Days:      sales?.soldQuantity14Days ?? 0,
        discountRate:     p.discountRate,
        sizeAvailability,
        ga4: ga4 ? { views: ga4.views, sessions: ga4.sessions, ctr: ga4.ctr, conversionRate: ga4.conversionRate } : undefined,
        scores: { newness: 0, bestSeller: 0, reviewScore: 0, stockScore: 0, availabilityScore: 0 },
        rankingScore:   0,
        isDisqualified: false,
        finalRank:      0,
      };
    });

    normalized = applyDisqualification(normalized, availabilityThreshold);
    normalized = computeRankingScores(normalized, config);

    // Phase 3: Sıralama ve yazma
    let ranked = buildFinalRanking(normalized);
    if (config.smartMix) ranked = applySmartMix(ranked);
    const disqualifiedCount = ranked.filter(p => p.isDisqualified).length;
    const qualifiedCount    = ranked.length - disqualifiedCount;

    await client.setKategoriSira(
      ranked.map(p => ({ productCode: p.productCode, categoryId, sortOrder: p.finalRank }))
    );

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
  const { categoryId, availabilityThreshold } = config;
  logger.info(`Preview başladı — kategori: ${categoryId}`);

  const client   = await getClientForUser(userId, tenantId);
  const apiUrl   = client.getBaseUrl();
  const products = await client.getCategoryProductsFull(categoryId);

  if (products.length === 0) {
    return { products: [], total: 0, qualifiedCount: 0, disqualifiedCount: 0, apiUrl, criteria: config.criteria };
  }

  const productCodes = products.map(p => p.productCode);
  const bestSellerCriterion = config.criteria.find(c => c.key === 'bestSeller');
  const salesDays = salesPeriodToDays(bestSellerCriterion?.salesPeriod);
  const salesData    = await client.getSalesReport(productCodes, salesDays);
  const salesMap     = new Map<string, TSoftSalesData>(salesData.map(s => [s.productCode, s]));

  // GA4 metrikleri — periyoda göre önbellekten veya auto-sync
  const ga4Map = await resolveGa4Map(config, userId);

  // imageCount is stored per-product alongside normalized data
  const imageCountMap = new Map<string, number>(products.map(p => [p.productCode, p.imageCount]));
  const imageUrlMap   = new Map<string, string>(products.map(p => [p.productCode, p.imageUrl]));
  const productIdMap  = new Map<string, string>(products.map(p => [p.productCode, p.productId]));
  const seoUrlMap     = new Map<string, string>(products.map(p => [p.productCode, p.seoUrl]));

  let normalized: NormalizedProduct[] = products.map((p: TSoftProduct) => {
    const sales            = salesMap.get(p.productCode);
    const sizeAvailability = computeSizeAvailability(p.variants, availabilityThreshold);
    const ga4 = ga4Map.get(p.productId) ?? ga4Map.get(p.productCode);
    return {
      productId:        p.productId,
      productCode:      p.productCode,
      productName:      p.productName,
      categoryId:       p.categoryId,
      registrationDate: new Date(p.registrationDate),
      reviewCount:      p.reviewCount,
      sales14Days:      sales?.soldQuantity14Days ?? 0,
      discountRate:     p.discountRate,
      sizeAvailability,
      ga4: ga4 ? { views: ga4.views, sessions: ga4.sessions, ctr: ga4.ctr, conversionRate: ga4.conversionRate } : undefined,
      scores:        { newness: 0, bestSeller: 0, reviewScore: 0, stockScore: 0, availabilityScore: 0 },
      rankingScore:   0,
      isDisqualified: false,
      finalRank:      0,
    };
  });

  normalized = applyDisqualification(normalized, availabilityThreshold);
  normalized = computeRankingScores(normalized, config);
  let ranked = buildFinalRanking(normalized);
  if (config.smartMix) ranked = applySmartMix(ranked);
  const qualifiedCount   = ranked.filter(p => !p.isDisqualified).length;
  const disqualifiedCount = ranked.length - qualifiedCount;

  const items: ProductPreviewItem[] = ranked.map(p => {
    const contributions: Partial<Record<CriterionKey, number>> = {};
    for (const c of config.criteria) {
      contributions[c.key] = ((p.scores[c.key] ?? 0) * c.weight) / 100;
    }
    return {
      finalRank:             p.finalRank,
      productId:             productIdMap.get(p.productCode) ?? '',
      productCode:           p.productCode,
      productName:           p.productName,
      isDisqualified:        p.isDisqualified,
      disqualifyReason:      p.disqualifyReason,
      rankingScore:          p.rankingScore,
      scores:                p.scores,
      criteriaContributions: contributions,
      totalStock:            p.sizeAvailability.totalStock,
      availabilityRate:      p.sizeAvailability.availabilityRate,
      sales14Days:           p.sales14Days,
      reviewCount:           p.reviewCount,
      discountRate:          p.discountRate,
      seoUrl:                seoUrlMap.get(p.productCode) ?? '',
      registrationDate:      p.registrationDate.toISOString(),
      imageCount:            imageCountMap.get(p.productCode) ?? 0,
      imageUrl:              imageUrlMap.get(p.productCode) ?? '',
      ga4:                   p.ga4,
    };
  });

  logger.info(`Preview bitti — ${qualifiedCount} aktif, ${disqualifiedCount} disqualified`);
  return { products: items, total: ranked.length, qualifiedCount, disqualifiedCount, apiUrl, criteria: config.criteria };
}

export async function applyManualRanking(
  categoryId: string,
  items: { productCode: string; rank: number }[],
  userId = 0,
  tenantId?: number
): Promise<void> {
  const client = await getClientForUser(userId, tenantId);
  await client.setKategoriSira(
    items.map(item => ({ productCode: item.productCode, categoryId, sortOrder: item.rank }))
  );
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
