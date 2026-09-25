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

/* Single source of truth for criterion colours, in criterion order. The donut,
   legend cards (tint + left border), weight bar, weight-input dots, criterion
   cards and saved-config chips all read from here via criteriaColor(i). */
export const CRITERIA_COLORS = [
  '#1CCAC7', // K1 — Turkuaz
  '#7C5CFF', // K2 — Mor
  '#EC5B8C', // K3 — Pembe
  '#4C8DF6', // K4 — Mavi
  '#F5A524', // K5 — Turuncu
] as const;


export const criteriaColor  = (i: number): string => CRITERIA_COLORS[i % CRITERIA_COLORS.length];


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
