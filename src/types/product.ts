export type CriterionKey =
  | 'newness'
  | 'bestSeller'
  | 'reviewScore'
  | 'stockScore'
  | 'availabilityScore'
  | 'discountRate'
  | 'tsoftViews'
  | 'tsoftCartAdds'
  | 'tsoftConversionRate';

export interface WeightCriterion {
  key: CriterionKey;
  weight: number; // 0-100, toplam 4 kriterin toplamı = 100
  direction?: 'asc' | 'desc';
  salesPeriod?: '1d' | '3d' | '7d' | '14d' | '21d' | '1m' | '2m' | '3m';
}

export interface WeightConfig {
  categoryId: string;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion];
  availabilityThreshold: number; // 0.0 - 1.0
  smartMix?: boolean;
}

export interface SizeAvailability {
  totalVariants: number;
  inStockVariants: number;
  availabilityRate: number;
  totalStock: number;
  isSingleSize: boolean;
  passesThreshold: boolean;
}

export interface TsoftRawStats {
  views:            number; // ürün sayfası görüntülenme
  cartAdds:         number; // sepete ekleme
  conversionRate:   number; // satış / görüntülenme (0-100)
}

export interface ProductScores {
  newness: number;
  bestSeller: number;
  reviewScore: number;
  stockScore: number;
  availabilityScore: number;
  discountRate?: number;
  tsoftViews?: number;
  tsoftCartAdds?: number;
  tsoftConversionRate?: number;
}

export interface NormalizedProduct {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  registrationDate: Date;
  reviewCount: number;
  salesQty: number; // seçilen salesPeriod'a göre çekilen satış adedi
  discountRate: number;
  isActive: boolean;
  sizeAvailability: SizeAvailability;
  tsoftStats?: TsoftRawStats;
  scores: ProductScores;
  rankingScore: number;
  isDisqualified: boolean;
  disqualifyReason?: string;
  finalRank: number;
}
