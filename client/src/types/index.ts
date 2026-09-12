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
  '#1CCAC7', // K1 — Bright Teal
  '#2F226C', // K2 — Rich Violet
  '#151035', // K3 — Deep Space Violet
  '#5C5680', // K4 — Muted violet-gray
  '#9A94B8', // K5 — Light violet-gray
];

/* Legible text color for each CRITERION_COLORS fill — teal and the light
   violet-gray need dark text, the darker violets need white. */
export const CRITERION_TEXT_ON: string[] = [
  '#151035', // on Bright Teal
  '#FAFAFA', // on Rich Violet
  '#FAFAFA', // on Deep Space Violet
  '#FAFAFA', // on Muted violet-gray
  '#151035', // on Light violet-gray
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
