import type { TSoftProduct, TSoftRankPayload, TSoftSalesData } from '../types/tsoft';

export interface TSoftClientApi {
  getBaseUrl(): string;

  getCategories(): Promise<{ categoryId: string; name: string; parentCategoryId: string }[]>;
  getCategoryProductsRawSample(categoryId: string, limit?: number): Promise<Record<string, unknown>[]>;
  getCategoryProducts(categoryId: string): Promise<{ productCode: string }[]>;
  getCategoryProductsSorted(categoryId: string): Promise<TSoftProduct[]>;
  /** `fresh` skips the cached copy (the result still refreshes the cache). */
  getCategoryProductsFull(categoryId: string, opts?: { fresh?: boolean }): Promise<TSoftProduct[]>;
  getProductDetails(productCodes: string[]): Promise<TSoftProduct[]>;

  getSalesReport(productCodes: string[], days: number): Promise<TSoftSalesData[]>;
  setKategoriSira(payload: TSoftRankPayload[]): Promise<{ ok: number; fail: number }>;
}
