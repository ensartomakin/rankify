import type { TSoftClientApi } from './tsoft-client-api';
import type { TSoftProduct, TSoftRankPayload, TSoftSalesData, TSoftVariant } from '../types/tsoft';

type DemoCategory = { categoryId: string; name: string; parentCategoryId: string };
type DemoProductSpec = Omit<TSoftProduct, 'sortOrder'> & { baseDailySales: number };

const DEMO_BASE_URL = 'https://demo.rankify.local';

const DEMO_CATEGORIES: DemoCategory[] = [
  { categoryId: '1100', name: 'Kadın Tişört', parentCategoryId: '0' },
  { categoryId: '1200', name: 'Kadın Elbise', parentCategoryId: '0' },
  { categoryId: '1300', name: 'Erkek Gömlek', parentCategoryId: '0' },
  { categoryId: '1400', name: 'Denim & Jean', parentCategoryId: '0' },
  { categoryId: '1500', name: 'Dış Giyim', parentCategoryId: '0' },
];

function v(sizeName: string, stock: number, price: number, variantId: string, barcode: string): TSoftVariant {
  return { variantId, sizeName, barcode, stock, price };
}

function imgSeed(code: string) {
  return `https://picsum.photos/seed/rankify-demo-${encodeURIComponent(code)}/800/800`;
}

function makeProduct(input: {
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryPath: string;
  registrationDate: string;
  reviewCount: number;
  variants: TSoftVariant[];
  discountRate: number;
  baseDailySales: number;
}): DemoProductSpec {
  return {
    productId: input.productId,
    productCode: input.productCode,
    productName: input.productName,
    categoryId: input.categoryId,
    categoryPath: input.categoryPath,
    registrationDate: input.registrationDate,
    imageCount: 1,
    imageUrl: imgSeed(input.productCode),
    reviewCount: input.reviewCount,
    variants: input.variants,
    discountRate: input.discountRate,
    seoUrl: `${DEMO_BASE_URL}/urun-detay/${encodeURIComponent(input.productCode)}`,
    baseDailySales: input.baseDailySales,
  };
}

const DEMO_PRODUCTS: DemoProductSpec[] = [
  // 1100 — Kadın Tişört (4)
  makeProduct({
    productId: '900001',
    productCode: 'DTX-TS-001',
    productName: 'Pamuk Basic Tişört (Beyaz)',
    categoryId: '1100',
    categoryPath: 'Tekstil > Kadın > Tişört',
    registrationDate: '2026-03-14T10:00:00.000Z',
    reviewCount: 214,
    discountRate: 12,
    baseDailySales: 8.2,
    variants: [
      v('S', 14, 299.9, '900001-1', '8690009000011'),
      v('M', 22, 299.9, '900001-2', '8690009000012'),
      v('L', 18, 299.9, '900001-3', '8690009000013'),
      v('XL', 9, 299.9, '900001-4', '8690009000014'),
    ],
  }),
  makeProduct({
    productId: '900002',
    productCode: 'DTX-TS-002',
    productName: 'Oversize Tişört (Siyah)',
    categoryId: '1100',
    categoryPath: 'Tekstil > Kadın > Tişört',
    registrationDate: '2026-02-02T10:00:00.000Z',
    reviewCount: 98,
    discountRate: 25,
    baseDailySales: 5.1,
    variants: [
      v('S', 10, 349.9, '900002-1', '8690009000021'),
      v('M', 0, 349.9, '900002-2', '8690009000022'),
      v('L', 7, 349.9, '900002-3', '8690009000023'),
      v('XL', 6, 349.9, '900002-4', '8690009000024'),
    ],
  }),
  makeProduct({
    productId: '900003',
    productCode: 'DTX-TS-003',
    productName: 'Çizgili Crop Tişört (Lacivert)',
    categoryId: '1100',
    categoryPath: 'Tekstil > Kadın > Tişört',
    registrationDate: '2025-12-20T10:00:00.000Z',
    reviewCount: 45,
    discountRate: 0,
    baseDailySales: 2.2,
    variants: [
      v('S', 6, 279.9, '900003-1', '8690009000031'),
      v('M', 4, 279.9, '900003-2', '8690009000032'),
      v('L', 3, 279.9, '900003-3', '8690009000033'),
      v('XL', 1, 279.9, '900003-4', '8690009000034'),
    ],
  }),
  makeProduct({
    productId: '900004',
    productCode: 'DTX-TS-004',
    productName: 'V Yaka Ribana Tişört (Taş)',
    categoryId: '1100',
    categoryPath: 'Tekstil > Kadın > Tişört',
    registrationDate: '2025-10-05T10:00:00.000Z',
    reviewCount: 167,
    discountRate: 18,
    baseDailySales: 3.4,
    variants: [
      v('S', 3, 319.9, '900004-1', '8690009000041'),
      v('M', 2, 319.9, '900004-2', '8690009000042'),
      v('L', 0, 319.9, '900004-3', '8690009000043'),
      v('XL', 5, 319.9, '900004-4', '8690009000044'),
    ],
  }),

  // 1200 — Kadın Elbise (4)
  makeProduct({
    productId: '900101',
    productCode: 'DTX-EL-001',
    productName: 'Keten Midi Elbise (Bej)',
    categoryId: '1200',
    categoryPath: 'Tekstil > Kadın > Elbise',
    registrationDate: '2026-04-01T10:00:00.000Z',
    reviewCount: 62,
    discountRate: 10,
    baseDailySales: 4.6,
    variants: [
      v('S', 7, 899.9, '900101-1', '8690009001011'),
      v('M', 11, 899.9, '900101-2', '8690009001012'),
      v('L', 5, 899.9, '900101-3', '8690009001013'),
      v('XL', 2, 899.9, '900101-4', '8690009001014'),
    ],
  }),
  makeProduct({
    productId: '900102',
    productCode: 'DTX-EL-002',
    productName: 'Saten Askılı Elbise (Zümrüt)',
    categoryId: '1200',
    categoryPath: 'Tekstil > Kadın > Elbise',
    registrationDate: '2026-01-18T10:00:00.000Z',
    reviewCount: 29,
    discountRate: 30,
    baseDailySales: 2.9,
    variants: [
      v('S', 4, 999.9, '900102-1', '8690009001021'),
      v('M', 3, 999.9, '900102-2', '8690009001022'),
      v('L', 0, 999.9, '900102-3', '8690009001023'),
      v('XL', 2, 999.9, '900102-4', '8690009001024'),
    ],
  }),
  makeProduct({
    productId: '900103',
    productCode: 'DTX-EL-003',
    productName: 'Desenli Şifon Elbise (Çiçek)',
    categoryId: '1200',
    categoryPath: 'Tekstil > Kadın > Elbise',
    registrationDate: '2025-09-10T10:00:00.000Z',
    reviewCount: 312,
    discountRate: 35,
    baseDailySales: 6.8,
    variants: [
      v('S', 8, 1199.9, '900103-1', '8690009001031'),
      v('M', 0, 1199.9, '900103-2', '8690009001032'),
      v('L', 6, 1199.9, '900103-3', '8690009001033'),
      v('XL', 7, 1199.9, '900103-4', '8690009001034'),
    ],
  }),
  makeProduct({
    productId: '900104',
    productCode: 'DTX-EL-004',
    productName: 'Triko Elbise (Antrasit)',
    categoryId: '1200',
    categoryPath: 'Tekstil > Kadın > Elbise',
    registrationDate: '2025-11-22T10:00:00.000Z',
    reviewCount: 141,
    discountRate: 15,
    baseDailySales: 3.7,
    variants: [
      v('S', 6, 749.9, '900104-1', '8690009001041'),
      v('M', 5, 749.9, '900104-2', '8690009001042'),
      v('L', 1, 749.9, '900104-3', '8690009001043'),
      v('XL', 0, 749.9, '900104-4', '8690009001044'),
    ],
  }),

  // 1300 — Erkek Gömlek (4)
  makeProduct({
    productId: '900201',
    productCode: 'DTX-GM-001',
    productName: 'Oxford Gömlek (Mavi)',
    categoryId: '1300',
    categoryPath: 'Tekstil > Erkek > Gömlek',
    registrationDate: '2026-03-05T10:00:00.000Z',
    reviewCount: 88,
    discountRate: 20,
    baseDailySales: 4.1,
    variants: [
      v('S', 3, 799.9, '900201-1', '8690009002011'),
      v('M', 7, 799.9, '900201-2', '8690009002012'),
      v('L', 6, 799.9, '900201-3', '8690009002013'),
      v('XL', 2, 799.9, '900201-4', '8690009002014'),
    ],
  }),
  makeProduct({
    productId: '900202',
    productCode: 'DTX-GM-002',
    productName: 'Keten Gömlek (Beyaz)',
    categoryId: '1300',
    categoryPath: 'Tekstil > Erkek > Gömlek',
    registrationDate: '2026-02-11T10:00:00.000Z',
    reviewCount: 203,
    discountRate: 5,
    baseDailySales: 5.6,
    variants: [
      v('S', 4, 849.9, '900202-1', '8690009002021'),
      v('M', 0, 849.9, '900202-2', '8690009002022'),
      v('L', 5, 849.9, '900202-3', '8690009002023'),
      v('XL', 3, 849.9, '900202-4', '8690009002024'),
    ],
  }),
  makeProduct({
    productId: '900203',
    productCode: 'DTX-GM-003',
    productName: 'Ekose Flanel Gömlek (Kırmızı)',
    categoryId: '1300',
    categoryPath: 'Tekstil > Erkek > Gömlek',
    registrationDate: '2025-12-01T10:00:00.000Z',
    reviewCount: 57,
    discountRate: 28,
    baseDailySales: 2.3,
    variants: [
      v('S', 5, 699.9, '900203-1', '8690009002031'),
      v('M', 3, 699.9, '900203-2', '8690009002032'),
      v('L', 2, 699.9, '900203-3', '8690009002033'),
      v('XL', 0, 699.9, '900203-4', '8690009002034'),
    ],
  }),
  makeProduct({
    productId: '900204',
    productCode: 'DTX-GM-004',
    productName: 'Slim Fit Poplin Gömlek (Siyah)',
    categoryId: '1300',
    categoryPath: 'Tekstil > Erkek > Gömlek',
    registrationDate: '2025-08-15T10:00:00.000Z',
    reviewCount: 132,
    discountRate: 22,
    baseDailySales: 3.2,
    variants: [
      v('S', 2, 749.9, '900204-1', '8690009002041'),
      v('M', 2, 749.9, '900204-2', '8690009002042'),
      v('L', 0, 749.9, '900204-3', '8690009002043'),
      v('XL', 4, 749.9, '900204-4', '8690009002044'),
    ],
  }),

  // 1400 — Denim & Jean (4)
  makeProduct({
    productId: '900301',
    productCode: 'DTX-JN-001',
    productName: 'Yüksek Bel Mom Jean (Açık Mavi)',
    categoryId: '1400',
    categoryPath: 'Tekstil > Denim > Jean',
    registrationDate: '2026-03-22T10:00:00.000Z',
    reviewCount: 276,
    discountRate: 15,
    baseDailySales: 6.0,
    variants: [
      v('34', 6, 1099.9, '900301-1', '8690009003011'),
      v('36', 8, 1099.9, '900301-2', '8690009003012'),
      v('38', 5, 1099.9, '900301-3', '8690009003013'),
      v('40', 0, 1099.9, '900301-4', '8690009003014'),
    ],
  }),
  makeProduct({
    productId: '900302',
    productCode: 'DTX-JN-002',
    productName: 'Straight Fit Jean (Koyu Mavi)',
    categoryId: '1400',
    categoryPath: 'Tekstil > Denim > Jean',
    registrationDate: '2026-01-09T10:00:00.000Z',
    reviewCount: 64,
    discountRate: 35,
    baseDailySales: 3.3,
    variants: [
      v('30', 2, 999.9, '900302-1', '8690009003021'),
      v('32', 0, 999.9, '900302-2', '8690009003022'),
      v('34', 3, 999.9, '900302-3', '8690009003023'),
      v('36', 4, 999.9, '900302-4', '8690009003024'),
    ],
  }),
  makeProduct({
    productId: '900303',
    productCode: 'DTX-JN-003',
    productName: 'Skinny Jean (Siyah)',
    categoryId: '1400',
    categoryPath: 'Tekstil > Denim > Jean',
    registrationDate: '2025-11-02T10:00:00.000Z',
    reviewCount: 401,
    discountRate: 20,
    baseDailySales: 7.3,
    variants: [
      v('30', 3, 1049.9, '900303-1', '8690009003031'),
      v('32', 2, 1049.9, '900303-2', '8690009003032'),
      v('34', 0, 1049.9, '900303-3', '8690009003033'),
      v('36', 1, 1049.9, '900303-4', '8690009003034'),
    ],
  }),
  makeProduct({
    productId: '900304',
    productCode: 'DTX-JN-004',
    productName: 'Denim Ceket (Mavi)',
    categoryId: '1400',
    categoryPath: 'Tekstil > Denim > Ceket',
    registrationDate: '2025-09-28T10:00:00.000Z',
    reviewCount: 119,
    discountRate: 18,
    baseDailySales: 2.1,
    variants: [
      v('S', 4, 1299.9, '900304-1', '8690009003041'),
      v('M', 3, 1299.9, '900304-2', '8690009003042'),
      v('L', 1, 1299.9, '900304-3', '8690009003043'),
      v('XL', 0, 1299.9, '900304-4', '8690009003044'),
    ],
  }),

  // 1500 — Dış Giyim (4)
  makeProduct({
    productId: '900401',
    productCode: 'DTX-DG-001',
    productName: 'Kapüşonlu Şişme Mont (Siyah)',
    categoryId: '1500',
    categoryPath: 'Tekstil > Dış Giyim > Mont',
    registrationDate: '2025-10-30T10:00:00.000Z',
    reviewCount: 187,
    discountRate: 40,
    baseDailySales: 3.0,
    variants: [
      v('S', 2, 1999.9, '900401-1', '8690009004011'),
      v('M', 3, 1999.9, '900401-2', '8690009004012'),
      v('L', 0, 1999.9, '900401-3', '8690009004013'),
      v('XL', 1, 1999.9, '900401-4', '8690009004014'),
    ],
  }),
  makeProduct({
    productId: '900402',
    productCode: 'DTX-DG-002',
    productName: 'Kaban (Camel)',
    categoryId: '1500',
    categoryPath: 'Tekstil > Dış Giyim > Kaban',
    registrationDate: '2025-11-18T10:00:00.000Z',
    reviewCount: 73,
    discountRate: 15,
    baseDailySales: 1.6,
    variants: [
      v('S', 3, 2499.9, '900402-1', '8690009004021'),
      v('M', 2, 2499.9, '900402-2', '8690009004022'),
      v('L', 2, 2499.9, '900402-3', '8690009004023'),
      v('XL', 0, 2499.9, '900402-4', '8690009004024'),
    ],
  }),
  makeProduct({
    productId: '900403',
    productCode: 'DTX-DG-003',
    productName: 'Trençkot (Taş)',
    categoryId: '1500',
    categoryPath: 'Tekstil > Dış Giyim > Trençkot',
    registrationDate: '2026-02-26T10:00:00.000Z',
    reviewCount: 41,
    discountRate: 22,
    baseDailySales: 2.4,
    variants: [
      v('S', 2, 1799.9, '900403-1', '8690009004031'),
      v('M', 1, 1799.9, '900403-2', '8690009004032'),
      v('L', 0, 1799.9, '900403-3', '8690009004033'),
      v('XL', 2, 1799.9, '900403-4', '8690009004034'),
    ],
  }),
  makeProduct({
    productId: '900404',
    productCode: 'DTX-DG-004',
    productName: 'Rüzgarlık (Haki)',
    categoryId: '1500',
    categoryPath: 'Tekstil > Dış Giyim > Rüzgarlık',
    registrationDate: '2026-04-12T10:00:00.000Z',
    reviewCount: 26,
    discountRate: 8,
    baseDailySales: 3.5,
    variants: [
      v('S', 6, 899.9, '900404-1', '8690009004041'),
      v('M', 8, 899.9, '900404-2', '8690009004042'),
      v('L', 4, 899.9, '900404-3', '8690009004043'),
      v('XL', 0, 899.9, '900404-4', '8690009004044'),
    ],
  }),
];

const PRODUCTS_BY_CODE = new Map<string, DemoProductSpec>(DEMO_PRODUCTS.map(p => [p.productCode, p]));

function productsByCategory(categoryId: string): DemoProductSpec[] {
  return DEMO_PRODUCTS.filter(p => p.categoryId === categoryId);
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function variantAvgPrice(variants: TSoftVariant[]): number {
  if (!variants.length) return 0;
  return variants.reduce((s, vv) => s + (vv.price || 0), 0) / variants.length;
}

export class DemoTSoftClient implements TSoftClientApi {
  // Debug endpoint expects these via an `unknown as` cast.
  creds = { apiUrl: DEMO_BASE_URL, storeCode: 'demo', apiUser: 'demo', apiPass: 'demo' };

  private sortOverrides = new Map<string, number>(); // `${categoryId}::${productCode}` -> sortOrder

  getBaseUrl(): string {
    return DEMO_BASE_URL;
  }

  async getCategories(): Promise<DemoCategory[]> {
    return DEMO_CATEGORIES;
  }

  async post(_endpoint: string, _params: Record<string, unknown> = {}): Promise<unknown> {
    return { success: true, data: [] };
  }

  async getCategoryProductsRawSample(categoryId: string, limit = 3): Promise<Record<string, unknown>[]> {
    return productsByCategory(categoryId).slice(0, limit).map(p => ({
      ProductId: p.productId,
      ProductCode: p.productCode,
      ProductName: p.productName,
      CategoryIds: p.categoryId,
      RegistrationDate: p.registrationDate,
      DiscountRate: p.discountRate,
      ReviewCount: p.reviewCount,
      ImageUrl: p.imageUrl,
      Variants: p.variants.map(vv => ({
        VariantId: vv.variantId,
        SizeName: vv.sizeName,
        Barcode: vv.barcode,
        Stock: vv.stock,
        SellingPrice: vv.price,
      })),
      ListNo: this.getSortOrder(categoryId, p.productCode),
    }));
  }

  async getCategoryProducts(categoryId: string): Promise<{ productCode: string }[]> {
    return productsByCategory(categoryId).map(p => ({ productCode: p.productCode }));
  }

  private getSortOrder(categoryId: string, productCode: string): number {
    const key = `${categoryId}::${productCode}`;
    const overridden = this.sortOverrides.get(key);
    if (overridden !== undefined) return overridden;
    const idx = productsByCategory(categoryId).findIndex(p => p.productCode === productCode);
    return idx >= 0 ? idx + 1 : 999999;
  }

  async getCategoryProductsSorted(categoryId: string): Promise<TSoftProduct[]> {
    return productsByCategory(categoryId)
      .map(p => ({
        productId: p.productId,
        productCode: p.productCode,
        productName: p.productName,
        categoryId: p.categoryId,
        categoryPath: p.categoryPath,
        registrationDate: p.registrationDate,
        imageCount: p.imageCount,
        imageUrl: p.imageUrl,
        sortOrder: this.getSortOrder(categoryId, p.productCode),
        reviewCount: p.reviewCount,
        variants: p.variants,
        discountRate: p.discountRate,
        seoUrl: p.seoUrl,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCategoryProductsFull(categoryId: string): Promise<TSoftProduct[]> {
    // Demo'da "full" ile "sorted" aynÄ± dataseti dÃ¶ndÃ¼rÃ¼r.
    return this.getCategoryProductsSorted(categoryId);
  }

  async getProductDetails(productCodes: string[]): Promise<TSoftProduct[]> {
    const results: TSoftProduct[] = [];
    for (const code of productCodes) {
      const p = PRODUCTS_BY_CODE.get(code);
      if (!p) continue;
      results.push({
        productId: p.productId,
        productCode: p.productCode,
        productName: p.productName,
        categoryId: p.categoryId,
        categoryPath: p.categoryPath,
        registrationDate: p.registrationDate,
        imageCount: p.imageCount,
        imageUrl: p.imageUrl,
        sortOrder: this.getSortOrder(p.categoryId, p.productCode),
        reviewCount: p.reviewCount,
        variants: p.variants,
        discountRate: p.discountRate,
        seoUrl: p.seoUrl,
      });
    }
    return results;
  }

  async getSalesReport(productCodes: string[], days: number): Promise<TSoftSalesData[]> {
    const safeDays = clampInt(days, 1, 180);
    const result: TSoftSalesData[] = [];
    for (const code of productCodes) {
      const p = PRODUCTS_BY_CODE.get(code);
      if (!p) continue;
      const sold = clampInt(p.baseDailySales * safeDays, 0, 50_000);
      const price = variantAvgPrice(p.variants);
      result.push({
        productCode: code,
        soldQuantity14Days: sold,
        revenue14Days: Math.round(sold * price * (1 - (p.discountRate ?? 0) / 100) * 100) / 100,
      });
    }
    return result;
  }

  async setKategoriSira(payload: TSoftRankPayload[]): Promise<void> {
    for (const item of payload) {
      this.sortOverrides.set(`${item.categoryId}::${item.productCode}`, item.sortOrder);
    }
  }
}

export function createDemoTSoftClient(): DemoTSoftClient {
  return new DemoTSoftClient();
}
