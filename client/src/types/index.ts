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
  '#7C5CFF', // K2 — Violet
  '#F5A524', // K3 — Amber
  '#EC5B8C', // K4 — Pink
  '#4C8DF6', // K5 — Blue
];

/* Legible text color for each CRITERION_COLORS fill — only the violet is dark
   enough to carry white text; the rest take Deep Space Violet. */
export const CRITERION_TEXT_ON: string[] = [
  '#151035', // on Bright Teal
  '#FFFFFF', // on Violet
  '#151035', // on Amber
  '#151035', // on Pink
  '#151035', // on Blue
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
