export type CriterionKey =
  | 'newness'
  | 'bestSeller'
  | 'reviewScore'
  | 'stockScore'
  | 'availabilityScore'
  | 'discountRate'
  | 'ga4Views'
  | 'ga4CartAdds'
  | 'ga4ConversionRate'
  ;

export type SortDirection = 'desc' | 'asc';
export type SalesPeriod = '1d' | '3d' | '7d' | '14d' | '21d' | '1m' | '2m' | '3m';

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  newness:               'En yeniler',
  bestSeller:            'Çok satanlar',
  reviewScore:           'Yorum sayısı',
  stockScore:            'Stoğa göre',
  availabilityScore:     'Beden bulunurluğu',
  discountRate:          'İndirim oranı',
  ga4Views:              'GA4 · Görüntülenme',
  ga4CartAdds:           'GA4 · Sepete Ekleme',
  ga4ConversionRate:     'GA4 · Dönüşüm Oranı',
};

export const GA4_CRITERION_KEYS = new Set<CriterionKey>([
  'ga4Views', 'ga4CartAdds', 'ga4ConversionRate',
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

export const CRITERION_COLORS: string[] = [
  '#FF682C', // K1 — Ember Orange
  '#816729', // K2 — Brass
  '#202020', // K3 — Graphite
  '#4D4D4D', // K4 — Steel
  '#828282', // K5 — Slate
];

export interface WeightCriterion {
  key: CriterionKey;
  weight: number;
  direction: SortDirection;
  salesPeriod?: SalesPeriod;
}

export type SeasonPreFilter = 'none' | 'yaz-ilkbahar' | 'kis-sonbahar';

export interface WeightConfig {
  categoryId: string;
  availabilityThreshold: number;
  criteria: WeightCriterion[];
  smartMix?: boolean;
  seasonPreFilter?: SeasonPreFilter;
}

export interface TriggerResponse {
  message: string;
  categoryId: string;
}
