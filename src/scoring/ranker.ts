import { minMaxNormalize, logMinMaxNormalize } from '../utils/helpers';
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
    if (!p.isActive) {
      return { ...p, isDisqualified: true, disqualifyReason: 'Görünürlük kapalı' };
    }
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

const TSOFT_KEYS  = new Set(['tsoftStatViews', 'tsoftStatConversionRate', 'tsoftViews', 'tsoftCartAdds', 'tsoftConversionRate'] as const);

export function computeRankingScores(
  products: NormalizedProduct[],
  config: WeightConfig
): NormalizedProduct[] {
  validateWeights(config);

  const usedKeys = new Set(config.criteria.map(c => c.key));

  // Temel metrikler
  // Sayım bazlı metrikler (satış, stok, yorum) → log normalizasyon:
  // Bir outlier diğerlerini 0'a ezmez; ağırlıklar gerçek etkisini gösterir.
  const sales    = logMinMaxNormalize(products.map(p => p.salesQty));
  const reviews  = logMinMaxNormalize(products.map(p => p.reviewCount));
  const stock    = logMinMaxNormalize(products.map(p => p.sizeAvailability.totalStock));
  // Yenilik skoru zaten 0-100 aralığında — min-max yeterli
  const newness  = minMaxNormalize(products.map(p => newnessScore(p.registrationDate)));
  // İndirim oranı yüzdesel — min-max yeterli
  const discount = usedKeys.has('discountRate')
    ? minMaxNormalize(products.map(p => p.discountRate))
    : null;

  // T-Soft istatistik metrikleri — views/cartAdds sayım bazlı → log; cr oran → min-max
  const tsoftStatViewsNorm = usedKeys.has('tsoftStatViews')
    ? logMinMaxNormalize(products.map(p => p.statViews ?? 0))
    : null;
  const tsoftStatCrNorm = usedKeys.has('tsoftStatConversionRate')
    ? minMaxNormalize(products.map(p => p.statConversionRate ?? 0))
    : null;
  const tsoftViewsNorm = usedKeys.has('tsoftViews')
    ? logMinMaxNormalize(products.map(p => p.tsoftStats?.views ?? 0))
    : null;
  const tsoftCartNorm  = usedKeys.has('tsoftCartAdds')
    ? logMinMaxNormalize(products.map(p => p.tsoftStats?.cartAdds ?? 0))
    : null;
  const tsoftCrNorm    = usedKeys.has('tsoftConversionRate')
    ? minMaxNormalize(products.map(p => p.tsoftStats?.conversionRate ?? 0))
    : null;

  return products.map((p, i) => {
    const scores: NormalizedProduct['scores'] = {
      newness:           newness[i],
      bestSeller:        sales[i],
      reviewScore:       reviews[i],
      stockScore:        stock[i],
      availabilityScore: p.sizeAvailability.availabilityRate * 100,
      ...(discount             && { discountRate:    discount[i] }),
      ...(tsoftStatViewsNorm   && { tsoftStatViews:           tsoftStatViewsNorm[i] }),
      ...(tsoftStatCrNorm      && { tsoftStatConversionRate: tsoftStatCrNorm[i] }),
      ...(tsoftViewsNorm       && { tsoftViews:              tsoftViewsNorm[i] }),
      ...(tsoftCartNorm  && { tsoftCartAdds:       tsoftCartNorm[i] }),
      ...(tsoftCrNorm    && { tsoftConversionRate: tsoftCrNorm[i] }),
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
