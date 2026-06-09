import type { TSoftProduct, TSoftRankPayload, TSoftSalesData, TSoftProductStats } from '../types/tsoft';

export interface TSoftClientApi {
  getBaseUrl(): string;

  getCategories(): Promise<{ categoryId: string; name: string; parentCategoryId: string }[]>;
  getCategoryProductsRawSample(categoryId: string, limit?: number): Promise<Record<string, unknown>[]>;
  getCategoryProducts(categoryId: string): Promise<{ productCode: string }[]>;
  getCategoryProductsSorted(categoryId: string): Promise<TSoftProduct[]>;
  getCategoryProductsFull(categoryId: string): Promise<TSoftProduct[]>;
  getProductDetails(productCodes: string[]): Promise<TSoftProduct[]>;

  getSalesReport(productCodes: string[], days: number): Promise<TSoftSalesData[]>;
  getProductStats(days: number): Promise<TSoftProductStats[]>;
  setKategoriSira(payload: TSoftRankPayload[]): Promise<void>;
}
