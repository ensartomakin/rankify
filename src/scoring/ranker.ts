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

export function computeRankingScores(
  products: NormalizedProduct[],
  config: WeightConfig
): NormalizedProduct[] {
  validateWeights(config);

  const sales   = minMaxNormalize(products.map(p => p.sales14Days));
  const reviews = minMaxNormalize(products.map(p => p.reviewCount));
  const stock   = minMaxNormalize(products.map(p => p.sizeAvailability.totalStock));

  return products.map((p, i) => {
    const scores = {
      newness:           newnessScore(p.registrationDate),
      bestSeller:        sales[i],
      reviewScore:       reviews[i],
      stockScore:        stock[i],
      availabilityScore: p.sizeAvailability.availabilityRate * 100,
    };

    const rankingScore = config.criteria.reduce((total, c) => {
      const raw = c.direction === 'asc' ? (100 - scores[c.key]) : scores[c.key];
      return total + (raw * c.weight) / 100;
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
