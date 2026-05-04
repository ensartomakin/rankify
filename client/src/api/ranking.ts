import { apiFetch } from './http';
import type { WeightConfig, WeightCriterion, TriggerResponse, CriterionKey } from '../types';

/* ─── Mevcut sıralama ─── */
export interface CurrentRankItem {
  currentRank: number;
  productId:   string;
  productCode: string;
  productName: string;
  imageUrl:    string;
  totalStock:  number;
  seoUrl:      string;
}

export interface CurrentRankingResponse {
  products: CurrentRankItem[];
  total:    number;
  apiUrl:   string;
}

export async function getCurrentRanking(categoryId: string): Promise<CurrentRankingResponse> {
  const res = await apiFetch(`/api/ranking/current?categoryId=${encodeURIComponent(categoryId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}

/* ─── Önizleme ─── */
export interface ProductPreviewItem {
  finalRank:             number;
  productId:             string;
  productCode:           string;
  productName:           string;
  isDisqualified:        boolean;
  disqualifyReason?:     string;
  rankingScore:          number;
  scores: {
    newness:           number;
    bestSeller:        number;
    reviewScore:       number;
    stockScore:        number;
    availabilityScore: number;
  };
  criteriaContributions: Partial<Record<CriterionKey, number>>;
  totalStock:            number;
  availabilityRate:      number;
  sales14Days:           number;
  reviewCount:           number;
  discountRate:          number;
  seoUrl:                string;
  registrationDate:      string;
  imageCount:            number;
  imageUrl:              string;
  ga4?: {
    views:          number;
    sessions:       number;
    ctr:            number;
    conversionRate: number;
  };
}

export interface PreviewResponse {
  products:          ProductPreviewItem[];
  total:             number;
  qualifiedCount:    number;
  disqualifiedCount: number;
  apiUrl:            string;
  criteria:          WeightConfig['criteria'];
}

export interface PreviewRequest {
  categoryId:             string;
  availabilityThreshold?: number;
  criteria?:              [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion];
  smartMix?:              boolean;
}

export async function previewRanking(req: PreviewRequest): Promise<PreviewResponse> {
  const res = await apiFetch('/api/ranking/preview', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errVal = body?.error;
    const msg = typeof errVal === 'string'
      ? errVal
      : errVal?.formErrors?.[0] ?? JSON.stringify(errVal) ?? `Hata: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

/* ─── Manuel sıralama uygula ─── */
export async function applyManualRanking(
  categoryId: string,
  products: { productCode: string; rank: number }[]
): Promise<void> {
  const res = await apiFetch('/api/ranking/manual', {
    method: 'POST',
    body: JSON.stringify({ categoryId, products }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
}

/* ─── Tetikleme ─── */
export async function triggerRanking(config: WeightConfig): Promise<TriggerResponse> {
  const res = await apiFetch('/api/ranking/trigger', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.formErrors?.[0] ?? `Hata: ${res.status}`);
  }
  return res.json();
}
