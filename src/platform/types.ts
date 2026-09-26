/**
 * Platform-neutral product model. Everything outside src/platform/* works
 * with these types only; each e-commerce platform maps its own API data to
 * them in its adapter.
 */
import type { FieldMapping, FieldOption } from '../types/field-mapping';
export type { FieldMapping, FieldOption };

export interface PlatformCategory {
  id:       string;
  name:     string;
  parentId: string;
}

export interface PlatformVariant {
  id:    string;
  size:  string;
  stock: number;
}

export interface PlatformProduct {
  id:           string;     // platform's internal product id
  code:         string;     // SKU / product code — the key used when applying a sort
  name:         string;
  categoryId:   string;
  categoryPath: string;
  createdAt:    string;     // ISO date the product was added
  imageUrls:    string[];   // absolute URLs, best (largest) first — the UI tries them in order
  url:          string;     // absolute product page URL ('' if unknown)
  season:       string;     // season tag, read from the field chosen in the field mapping
  isActive:     boolean;    // visible in the store
  discountRate: number;     // 0-100
  reviewCount:  number;
  variants:     PlatformVariant[];
}

export interface SalesStat {
  code:     string;
  quantity: number;         // units sold in the requested period
}

export interface SortEntry {
  code:     string;
  position: number;         // 1-based
}

export interface ApplyResult { ok: number; fail: number }

export interface PlatformAdapter {
  /** 'tsoft', 'demo', … */
  readonly platform: string;
  /** Store's public base URL. */
  readonly storeUrl: string;

  getCategories(): Promise<PlatformCategory[]>;
  /** All products of a category with full details (for scoring). */
  getProducts(categoryId: string): Promise<PlatformProduct[]>;
  /** Products in the order the store currently shows them. */
  getProductsInStoreOrder(categoryId: string): Promise<PlatformProduct[]>;
  getSales(codes: string[], days: number): Promise<SalesStat[]>;
  applySorting(categoryId: string, entries: SortEntry[]): Promise<ApplyResult>;
  /** Category identifier the store's bulk sort import expects (CSV export). */
  exportCategoryCode(categoryId: string): string;
}

/** Static description of a platform: what settings need before an adapter exists. */
export interface PlatformInfo {
  id:           string;
  label:        string;
  fieldOptions: { season: FieldOption[] };
  defaultFieldMapping: Required<FieldMapping>;
  /** Checks connection settings before they are saved. */
  testConnection(creds: ConnectionSettings): Promise<{ ok: boolean; message: string; debug?: string }>;
}

/** Connection settings as entered in Settings (platform-specific meaning). */
export interface ConnectionSettings {
  apiUrl:    string;
  storeCode: string;
  apiUser:   string;
  apiPass:   string;
  apiToken?: string;
}
