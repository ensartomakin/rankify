import { minMaxNormalize } from '../utils/helpers';
import type { NormalizedProduct, WeightConfig } from '../types/product';

export function validateWeights(config: WeightConfig): void {
  const total = config.criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`Ağırlık toplamı 100 olmalı, şu an: ${total}`);
  }
}

function newnessScore(date: Date): number {
  const ageDays = (Date.now() - date.getTime()) / 86_400_000;
  // 0 gün → 100, 365 gün → 0, linear decay
  return Math.max(0, Math.round(100 - (ageDays / 365) * 100));
}

export function applyDisqualification(
  products: NormalizedProduct[],
  threshold: number
): NormalizedProduct[] {
  return products.map(p => {
    if (p.sizeAvailability.totalStock === 0) {
      return { ...p, isDisqualified: true, disqualifyReason: 'Stok yok' };
    }
    if (!p.sizeAvailability.isSingleSize && !p.sizeAvailability.passesThreshold) {
      const pct = Math.round(p.sizeAvailability.availabilityRate * 100);
      return {
        ...p,
        isDisqualified: true,
        disqualifyReason: `Bulunurluk yetersiz (%${pct} < %${Math.round(threshold * 100)})`,
      };
    }
    return { ...p, isDisqualified: false };
  });
}

const GA4_KEYS = new Set(['ga4Views', 'ga4Sessions', 'ga4Ctr', 'ga4ConversionRate'] as const);

export function computeRankingScores(
  products: NormalizedProduct[],
  config: WeightConfig
): NormalizedProduct[] {
  validateWeights(config);

  const usedKeys = new Set(config.criteria.map(c => c.key));

  // Temel metrikler
  const sales    = minMaxNormalize(products.map(p => p.sales14Days));
  const reviews  = minMaxNormalize(products.map(p => p.reviewCount));
  const stock    = minMaxNormalize(products.map(p => p.sizeAvailability.totalStock));
  const discount = usedKeys.has('discountRate')
    ? minMaxNormalize(products.map(p => p.discountRate))
    : null;

  // GA4 metrikleri — sadece konfigürasyonda kullanılanları normalize et
  const ga4ViewsNorm    = usedKeys.has('ga4Views')
    ? minMaxNormalize(products.map(p => p.ga4?.views ?? 0))
    : null;
  const ga4SessionsNorm = usedKeys.has('ga4Sessions')
    ? minMaxNormalize(products.map(p => p.ga4?.sessions ?? 0))
    : null;
  const ga4CtrNorm      = usedKeys.has('ga4Ctr')
    ? minMaxNormalize(products.map(p => p.ga4?.ctr ?? 0))
    : null;
  const ga4CrNorm       = usedKeys.has('ga4ConversionRate')
    ? minMaxNormalize(products.map(p => p.ga4?.conversionRate ?? 0))
    : null;

  return products.map((p, i) => {
    const scores: NormalizedProduct['scores'] = {
      newness:           newnessScore(p.registrationDate),
      bestSeller:        sales[i],
      reviewScore:       reviews[i],
      stockScore:        stock[i],
      availabilityScore: p.sizeAvailability.availabilityRate * 100,
      ...(discount       && { discountRate:        discount[i] }),
      ...(ga4ViewsNorm   && { ga4Views:            ga4ViewsNorm[i] }),
      ...(ga4SessionsNorm && { ga4Sessions:        ga4SessionsNorm[i] }),
      ...(ga4CtrNorm     && { ga4Ctr:              ga4CtrNorm[i] }),
      ...(ga4CrNorm      && { ga4ConversionRate:   ga4CrNorm[i] }),
    };

    const rankingScore = config.criteria.reduce((total, c) => {
      const raw = scores[c.key] ?? 0;
      const directed = c.direction === 'asc' ? (100 - raw) : raw;
      return total + (directed * c.weight) / 100;
    }, 0);

    return { ...p, scores, rankingScore };
  });
}

export function buildFinalRanking(products: NormalizedProduct[]): NormalizedProduct[] {
  const qualified = products
    .filter(p => !p.isDisqualified)
    .sort((a, b) => b.rankingScore - a.rankingScore);

  // Disqualified ürünler: kendi içinde stok miktarına göre sıralanır
  const disqualified = products
    .filter(p => p.isDisqualified)
    .sort((a, b) => b.sizeAvailability.totalStock - a.sizeAvailability.totalStock);

  return [...qualified, ...disqualified].map((p, i) => ({
    ...p,
    finalRank: i + 1,
  }));
}
