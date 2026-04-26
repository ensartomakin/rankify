import { apiFetch } from './http';

export interface TsoftCategory {
  categoryId:       string;
  name:             string;
  parentCategoryId: string;
}

export interface TsoftProductSummary {
  productCode: string;
  name:        string;
  imageCount:  number;
}

export async function fetchCategories(): Promise<TsoftCategory[]> {
  const res = await apiFetch('/api/catalog/categories');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  const data = await res.json();
  return data.categories ?? [];
}

export async function fetchCategoryProducts(categoryId: string): Promise<{ products: TsoftProductSummary[]; total: number }> {
  const res = await apiFetch(`/api/catalog/categories/${categoryId}/products`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}
