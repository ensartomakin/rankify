import { minMaxNormalize, logMinMaxNormalize } from '../utils/helpers';
import type { NormalizedProduct, WeightConfig } from '../types/product';

export function validateWeights(config: WeightConfig): void {
  const total = config.criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new Error(`Ağırlık toplamı 100 olmalı, şu an: ${total}`);
  }
}

/**
 * Yenilik puanı — listedeki ürünlere GÖRE (0-100, en yeni 100).
 *
 * Eski sürüm mutlak bir ölçek kullanıyordu: 0 gün → 100, 365 gün ve üstü → 0.
 * Bir yıldan eski ürünlerin hepsi 0 alıyor, min-max normalizasyonu da
 * "hepsi eşit ve 0" durumunda herkese 0 verdiği için yenilik kriteri kategori
 * tamamen 1 yıldan eskiyse hiçbir ürüne puan katmıyordu.
 *
 * Artık ürün yaşları (gün) log ölçekte normalize edilip ters çevriliyor:
 * sıralama her zaman tarihlere göre ayrışıyor, çok eski tek bir ürün de
 * diğerlerini 100'e sıkıştırmıyor. Geçersiz tarih en eski kabul edilir.
 */
function newnessScores(dates: Date[]): number[] {
  const now = Date.now();
  const ages = dates.map(d => {
    const t = d.getTime();
    return Number.isFinite(t) ? Math.max(0, (now - t) / 86_400_000) : NaN;
  });
  const oldest = Math.max(0, ...ages.filter(Number.isFinite));
  const filled = ages.map(a => (Number.isFinite(a) ? a : oldest));
  return logMinMaxNormalize(filled).map(v => 100 - v);
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
        disqualifyReason: `Beden oranı %${Math.round(threshold * 100)} altında (%${pct})`,
      };
    }
    return { ...p, isDisqualified: false };
  });
}

const GA4_KEYS    = new Set(['ga4Views', 'ga4CartAdds', 'ga4ConversionRate'] as const);

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
  // Yenilik: ürün yaşı (gün) → log normalizasyon, ters çevrilmiş (en yeni = 100)
  const newness  = newnessScores(products.map(p => p.registrationDate));
  // İndirim oranı yüzdesel — min-max yeterli
  const discount = usedKeys.has('discountRate')
    ? minMaxNormalize(products.map(p => p.discountRate))
    : null;

  // GA4 metrikleri — sayım bazlı → log normalizasyon
  const ga4ViewsNorm    = usedKeys.has('ga4Views')
    ? logMinMaxNormalize(products.map(p => p.ga4?.views ?? 0))
    : null;
  const ga4CartAddsNorm = usedKeys.has('ga4CartAdds')
    ? logMinMaxNormalize(products.map(p => p.ga4?.cartAdds ?? 0))
    : null;
  const ga4CrNorm       = usedKeys.has('ga4ConversionRate')
    ? minMaxNormalize(products.map(p => p.ga4?.conversionRate ?? 0))
    : null;

  return products.map((p, i) => {
    const scores: NormalizedProduct['scores'] = {
      newness:           newness[i],
      bestSeller:        sales[i],
      reviewScore:       reviews[i],
      stockScore:        stock[i],
      availabilityScore: p.sizeAvailability.availabilityRate * 100,
      ...(discount       && { discountRate:        discount[i] }),
      ...(ga4ViewsNorm    && { ga4Views:          ga4ViewsNorm[i] }),
      ...(ga4CartAddsNorm && { ga4CartAdds:       ga4CartAddsNorm[i] }),
      ...(ga4CrNorm       && { ga4ConversionRate: ga4CrNorm[i] }),
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
