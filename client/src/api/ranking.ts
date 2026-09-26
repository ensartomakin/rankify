import { apiFetch } from './http';
import type { WeightConfig, WeightCriterion, TriggerResponse, CriterionKey, SeasonPreFilter } from '../types';

/* ─── Mevcut sıralama ─── */
export interface CurrentRankItem {
  currentRank: number;
  productId:   string;
  productCode: string;
  productName: string;
  productUrl:  string;     // absolute product page URL (from the platform adapter)
  imageUrls:   string[];   // absolute, best first — tried in order
  totalStock:  number;
}

export interface CurrentRankingResponse {
  products: CurrentRankItem[];
  total:    number;
  apiUrl:   string;
  categoryExportCode: string;   // category id in the store's sort-import format
}

/* Older API versions sent a single (maybe relative) imageUrl/seoUrl instead of
   productUrl/imageUrls. Fill the new fields from those so the UI works against
   either version. Platform-neutral: only joins relative paths to the store URL. */
type LegacyItem = { productUrl?: string; imageUrls?: string[]; imageUrl?: string; seoUrl?: string };
function withUrls<T extends LegacyItem>(item: T, storeUrl: string): T & { productUrl: string; imageUrls: string[] } {
  const abs = (u: string) => (/^(https?:)?\/\//i.test(u) ? u : `${storeUrl.replace(/\/$/, '')}/${u.replace(/^\//, '')}`);
  return {
    ...item,
    productUrl: item.productUrl ?? (item.seoUrl ? abs(item.seoUrl) : ''),
    imageUrls:  item.imageUrls?.length ? item.imageUrls.map(abs) : item.imageUrl ? [abs(item.imageUrl)] : [],
  };
}

export async function getCurrentRanking(categoryId: string): Promise<CurrentRankingResponse> {
  const res = await apiFetch(`/api/ranking/current?categoryId=${encodeURIComponent(categoryId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  const data = await res.json();
  return { ...data, products: data.products.map((p: CurrentRankItem & LegacyItem) => withUrls(p, data.apiUrl ?? '')) };
}

/* ─── Önizleme ─── */
export interface ProductPreviewItem {
  finalRank:             number;
  productId:             string;
  productCode:           string;
  productName:           string;
  categoryPath:          string;
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
  salesQty:              number;
  reviewCount:           number;
  discountRate:          number;
  productUrl:            string;
  registrationDate:      string;
  imageUrls:             string[];
  season:                string;
  ga4?: {
    views:          number;
    sessions:       number;
    cartAdds:       number;
    conversionRate: number;
  };
}

export interface PreviewResponse {
  products:          ProductPreviewItem[];
  total:             number;
  qualifiedCount:    number;
  disqualifiedCount: number;
  apiUrl:            string;
  categoryExportCode: string;
  criteria:          WeightConfig['criteria'];
}

export interface PreviewRequest {
  categoryId:             string;
  availabilityThreshold?: number;
  criteria?:              WeightCriterion[];
  smartMix?:              boolean;
  seasonPreFilter?:       SeasonPreFilter;
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
  const data = await res.json();
  return { ...data, products: data.products.map((p: ProductPreviewItem & LegacyItem) => withUrls(p, data.apiUrl ?? '')) };
}

/* ─── AI destekli sıralama düzenleme ─── */
export type AdjustMatchField = 'category' | 'name' | 'code';

export type AdjustRule =
  | { type: 'keep_out_of_top'; matchField: AdjustMatchField; matchValue: string; topN: number; description: string }
  | { type: 'keep_in_top';     matchField: AdjustMatchField; matchValue: string; topN: number; description: string }
  | { type: 'pin_product';     productCode: string; position: number; description: string };

// Sunucu sadece sıralama için bu alanlara ihtiyaç duyar — tüm skor/görsel verisini
// tekrar göndermek büyük kategorilerde istek boyutu limitini aşıyordu.
export interface AiAdjustProduct {
  productCode:    string;
  productName:    string;
  categoryPath:   string;
  season:         string;
  isDisqualified: boolean;
  finalRank:      number;
}

export interface AiAdjustRequest {
  categoryId:      string;
  products:        AiAdjustProduct[];
  rules?:          AdjustRule[];
  instruction?:    string;
  smartMix?:       boolean;
  seasonPreFilter?: SeasonPreFilter;
}

export interface AiAdjustResponse {
  products:    AiAdjustProduct[];
  rules:       AdjustRule[];
  addedRules:  AdjustRule[];
}

export async function aiAdjustRanking(req: AiAdjustRequest): Promise<AiAdjustResponse> {
  const res = await apiFetch('/api/ranking/ai-adjust', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errVal = body?.error;
    const msg = typeof errVal === 'string'
      ? errVal
      : errVal?.formErrors?.[0]
        ?? (errVal?.fieldErrors ? Object.values(errVal.fieldErrors).flat()[0] : undefined)
        ?? JSON.stringify(errVal)
        ?? `Hata: ${res.status}`;
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
    const body = await res.json().catch(() => ({}));
    const errVal = body?.error;
    const msg = typeof errVal === 'string'
      ? errVal
      : errVal?.formErrors?.[0]
        ?? (errVal?.fieldErrors ? Object.values(errVal.fieldErrors).flat()[0] : undefined)
        ?? JSON.stringify(errVal)
        ?? `Hata: ${res.status}`;
    throw new Error(msg);
  }
}

/* ─── Tetikleme ─── */
export async function triggerRanking(config: WeightConfig): Promise<TriggerResponse> {
  const res = await apiFetch('/api/ranking/trigger', {
    method: 'POST',
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errVal = body?.error;
    const msg = typeof errVal === 'string'
      ? errVal
      : errVal?.formErrors?.[0]
        ?? (errVal?.fieldErrors ? Object.values(errVal.fieldErrors).flat()[0] : undefined)
        ?? JSON.stringify(errVal)
        ?? `Hata: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}
