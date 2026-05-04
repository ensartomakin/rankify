export type CriterionKey =
  | 'newness'
  | 'bestSeller'
  | 'reviewScore'
  | 'stockScore'
  | 'availabilityScore'
  | 'discountRate'
  | 'ga4Views'
  | 'ga4Sessions'
  | 'ga4Ctr'
  | 'ga4ConversionRate';

export type SortDirection = 'desc' | 'asc';
export type SalesPeriod = '1d' | '3d' | '7d' | '14d' | '21d' | '1m' | '2m' | '3m';

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  newness:            'En yeniler',
  bestSeller:         'Çok satanlar',
  reviewScore:        'Yorum sayısı',
  stockScore:         'Stoğa göre',
  availabilityScore:  'Beden bulunurluğu',
  discountRate:       'İndirim oranı',
  ga4Views:           'GA4 · Görüntülenme',
  ga4Sessions:        'GA4 · Oturum',
  ga4Ctr:             'GA4 · Tıklama Oranı (CTR)',
  ga4ConversionRate:  'GA4 · Dönüşüm Oranı',
};

export const GA4_CRITERION_KEYS = new Set<CriterionKey>([
  'ga4Views', 'ga4Sessions', 'ga4Ctr', 'ga4ConversionRate',
]);

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  '1d':  'Dün',
  '3d':  'Son 3 Gün',
  '7d':  'Son 7 Gün',
  '14d': 'Son 14 Gün',
  '21d': 'Son 21 Gün',
  '1m':  'Son 1 Ay',
  '2m':  'Son 2 Ay',
  '3m':  'Son 3 Ay',
};

export const CRITERION_COLORS: [string, string, string, string] = [
  '#E23260', // K1 — Cerise
  '#849A28', // K2 — Citron
  '#F2678E', // K3 — Deep Blush
  '#6366F1', // K4 — Indigo
];

export interface WeightCriterion {
  key: CriterionKey;
  weight: number;
  direction: SortDirection;
  salesPeriod?: SalesPeriod;
}

export interface WeightConfig {
  categoryId: string;
  availabilityThreshold: number;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion];
  smartMix?: boolean;
}

export interface TriggerResponse {
  message: string;
  categoryId: string;
}
