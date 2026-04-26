import { getClientForUser } from '../services/tsoft-client';
import { computeSizeAvailability } from '../scoring/availability';

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
}

export interface CurrentRankingResult {
  products: CurrentRankItem[];
  total:    number;
  apiUrl:   string;
}

export async function getCurrentRanking(
  categoryId: string,
  userId = 0
): Promise<CurrentRankingResult> {
  const client   = await getClientForUser(userId);
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
  registrationDate:     string;
  imageCount:           number;
  imageUrl:             string;
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
  userId = 0
): Promise<void> {
  const { categoryId, availabilityThreshold } = config;
  const startedAt = Date.now();
  logger.info(`Pipeline başladı — kategori: ${categoryId} [${triggeredBy}]`);

  try {
    // Phase 1: Veri toplama
    const client   = await getClientForUser(userId);
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

    // Phase 2: Normalleştirme
    const salesMap = new Map<string, TSoftSalesData>(
      salesData.map(s => [s.productCode, s])
    );

    let normalized: NormalizedProduct[] = products.map((p: TSoftProduct) => {
      const sales = salesMap.get(p.productCode);
      const sizeAvailability = computeSizeAvailability(p.variants, availabilityThreshold);

      return {
        productId:        p.productId,
        productCode:      p.productCode,
        productName:      p.productName,
        categoryId:       p.categoryId,
        registrationDate: new Date(p.registrationDate),
        reviewCount:      p.reviewCount,
        sales14Days:      sales?.soldQuantity14Days ?? 0,
        sizeAvailability,
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
  userId = 0
): Promise<PreviewResult> {
  const { categoryId, availabilityThreshold } = config;
  logger.info(`Preview başladı — kategori: ${categoryId}`);

  const client   = await getClientForUser(userId);
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

  // imageCount is stored per-product alongside normalized data
  const imageCountMap = new Map<string, number>(products.map(p => [p.productCode, p.imageCount]));
  const imageUrlMap   = new Map<string, string>(products.map(p => [p.productCode, p.imageUrl]));
  const productIdMap  = new Map<string, string>(products.map(p => [p.productCode, p.productId]));

  let normalized: NormalizedProduct[] = products.map((p: TSoftProduct) => {
    const sales            = salesMap.get(p.productCode);
    const sizeAvailability = computeSizeAvailability(p.variants, availabilityThreshold);
    return {
      productId:        p.productId,
      productCode:      p.productCode,
      productName:      p.productName,
      categoryId:       p.categoryId,
      registrationDate: new Date(p.registrationDate),
      reviewCount:      p.reviewCount,
      sales14Days:      sales?.soldQuantity14Days ?? 0,
      sizeAvailability,
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
      contributions[c.key] = (p.scores[c.key] * c.weight) / 100;
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
      registrationDate:      p.registrationDate.toISOString(),
      imageCount:            imageCountMap.get(p.productCode) ?? 0,
      imageUrl:              imageUrlMap.get(p.productCode) ?? '',
    };
  });

  logger.info(`Preview bitti — ${qualifiedCount} aktif, ${disqualifiedCount} disqualified`);
  return { products: items, total: ranked.length, qualifiedCount, disqualifiedCount, apiUrl, criteria: config.criteria };
}

export async function applyManualRanking(
  categoryId: string,
  items: { productCode: string; rank: number }[],
  userId = 0
): Promise<void> {
  const client = await getClientForUser(userId);
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
  configs: (WeightConfig & { userId?: number })[],
  triggeredBy: 'cron' | 'manual' = 'cron'
): Promise<void> {
  for (const config of configs) {
    await runRankingPipeline(config, triggeredBy, config.userId ?? 0);
    await sleep(2000);
  }
}
