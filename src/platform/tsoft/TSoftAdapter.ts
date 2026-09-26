/**
 * T-Soft implementation of PlatformAdapter. Wraps the existing TSoftClient
 * (HTTP, auth, caching unchanged) and translates its data to the neutral
 * model. Everything T-Soft-specific about URLs lives here.
 */
import type { TSoftClientApi } from '../../services/tsoft-client-api';
import type { TSoftProduct } from '../../types/tsoft';
import type { PlatformAdapter, PlatformCategory, PlatformProduct, SalesStat, SortEntry, ApplyResult, PlatformInfo } from '../types';
import { TSOFT_FIELD_OPTIONS, TSOFT_DEFAULT_SEASON_FIELD } from '../../services/tsoft-client';

export const TSOFT_PLATFORM: PlatformInfo = {
  id: 'tsoft',
  label: 'T-Soft',
  fieldOptions: { season: TSOFT_FIELD_OPTIONS },
  defaultFieldMapping: { season: TSOFT_DEFAULT_SEASON_FIELD },
};

const trimSlash = (u: string) => u.replace(/\/$/, '');

export function absoluteUrl(base: string, u: string): string {
  if (/^(https?:)?\/\//i.test(u)) return u;
  return `${trimSlash(base)}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** T-Soft product page: SEO slug under the store root, or /urun-detay/<code>. */
export function tsoftProductUrl(base: string, seoUrl: string, code: string): string {
  if (!seoUrl) return `${trimSlash(base)}/urun-detay/${code}`;
  return absoluteUrl(base, seoUrl.replace(/^\//, ''));
}

/** Last-resort image locations T-Soft stores use when the API gives no URL. */
function tsoftFallbackImages(base: string, productId: string, code: string): string[] {
  const b = trimSlash(base);
  const ids = [...new Set([productId, code.replace(/^[Tt]/, ''), code].filter(Boolean))];
  const paths = [
    (id: string) => `${b}/img/products/b/${id}_1.jpg`,
    (id: string) => `${b}/img/products/s/${id}_1.jpg`,
    (id: string) => `${b}/img/products/${id}_1.jpg`,
    (id: string) => `${b}/upload/urun/${id}_1.jpg`,
    (id: string) => `${b}/upload/urunler/${id}_1.jpg`,
    (id: string) => `${b}/UserFiles/Image/urun/${id}_1.jpg`,
  ];
  return ids.flatMap(id => paths.map(fn => fn(id)));
}

export function toPlatformProduct(p: TSoftProduct, base: string): PlatformProduct {
  const listed = [...(p.imageUrls ?? []), p.imageUrl].filter(Boolean).map(u => absoluteUrl(base, u));
  return {
    id:           p.productId,
    code:         p.productCode,
    name:         p.productName,
    categoryId:   p.categoryId,
    categoryPath: p.categoryPath ?? '',
    createdAt:    p.registrationDate,
    imageUrls:    [...new Set([...listed, ...tsoftFallbackImages(base, p.productId, p.productCode)])],
    url:          tsoftProductUrl(base, p.seoUrl, p.productCode),
    season:       p.season ?? '',
    isActive:     p.isActive,
    discountRate: p.discountRate,
    reviewCount:  p.reviewCount,
    variants:     p.variants.map(v => ({ id: v.variantId, size: v.sizeName, stock: v.stock })),
  };
}

export class TSoftAdapter implements PlatformAdapter {
  readonly platform: string;
  readonly storeUrl: string;

  constructor(private readonly client: TSoftClientApi, platform = 'tsoft') {
    this.platform = platform;
    this.storeUrl = client.getBaseUrl();
  }

  async getCategories(): Promise<PlatformCategory[]> {
    const cats = await this.client.getCategories();
    return cats.map(c => ({ id: c.categoryId, name: c.name, parentId: c.parentCategoryId }));
  }

  async getProducts(categoryId: string): Promise<PlatformProduct[]> {
    const items = await this.client.getCategoryProductsFull(categoryId);
    return items.map(p => toPlatformProduct(p, this.storeUrl));
  }

  async getProductsInStoreOrder(categoryId: string): Promise<PlatformProduct[]> {
    const items = await this.client.getCategoryProductsSorted(categoryId);
    return items.map(p => toPlatformProduct(p, this.storeUrl));
  }

  async getSales(codes: string[], days: number): Promise<SalesStat[]> {
    const rows = await this.client.getSalesReport(codes, days);
    return rows.map(r => ({ code: r.productCode, quantity: r.soldQuantity14Days }));
  }

  applySorting(categoryId: string, entries: SortEntry[]): Promise<ApplyResult> {
    return this.client.setKategoriSira(entries.map(e => ({ productCode: e.code, categoryId, sortOrder: e.position })));
  }

  /** Raw T-Soft client — only for T-Soft debug tooling. */
  get raw(): TSoftClientApi { return this.client; }
}
