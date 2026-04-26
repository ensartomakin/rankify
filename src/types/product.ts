export type CriterionKey =
  | 'newness'
  | 'bestSeller'
  | 'reviewScore'
  | 'stockScore'
  | 'availabilityScore';

export interface WeightCriterion {
  key: CriterionKey;
  weight: number; // 0-100, toplam 3 kriterin toplamı = 100
  direction?: 'asc' | 'desc';
  salesPeriod?: '1d' | '3d' | '7d' | '14d' | '21d' | '1m' | '2m' | '3m';
}

export interface WeightConfig {
  categoryId: string;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion];
  availabilityThreshold: number; // 0.0 - 1.0
  smartMix?: boolean;            // aynı renk varyantlarını yan yana getirme
}

export interface SizeAvailability {
  totalVariants: number;
  inStockVariants: number;
  availabilityRate: number;
  totalStock: number;
  isSingleSize: boolean;
  passesThreshold: boolean;
}

export interface ProductScores {
  newness: number;
  bestSeller: number;
  reviewScore: number;
  stockScore: number;
  availabilityScore: number;
}

export interface NormalizedProduct {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  registrationDate: Date;
  reviewCount: number;
  sales14Days: number;
  sizeAvailability: SizeAvailability;
  scores: ProductScores;
  rankingScore: number;
  isDisqualified: boolean;
  disqualifyReason?: string;
  finalRank: number;
}
