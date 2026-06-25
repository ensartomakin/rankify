export interface TSoftVariant {
  variantId: string;
  sizeName: string;
  barcode: string;
  stock: number;
  price: number;
}

export interface TSoftProduct {
  productId:        string;   // numeric DB id — used for image URLs
  productCode:      string;
  productName:      string;
  categoryId:       string;
  categoryPath:     string;
  registrationDate: string;
  imageCount:       number;
  imageUrl:         string;   // direct image URL if T-Soft returns it
  sortOrder:        number;   // current category display order (ListNo / SortOrder)
  reviewCount:      number;
  variants:         TSoftVariant[];
  discountRate:     number;   // 0-100, indirim yüzdesi
  seoUrl:           string;   // T-Soft ürün sayfası URL'si (SEOUrl / Url)
  isActive:         boolean;  // T-Soft görünürlük durumu — false ise sıralamadan dışlanır
  statViews?:       number;   // product/get StatViews — toplam sayfa görüntülenme
}

export interface TSoftSalesData {
  productCode:        string;
  soldQuantity14Days: number;
  revenue14Days:      number;
}

export interface TSoftRankPayload {
  productCode: string;
  categoryId:  string;
  sortOrder:   number;
}

export interface TSoftProductStats {
  productCode:  string;
  views:        number; // ürün sayfası görüntülenme
  cartAdds:     number; // sepete ekleme adedi
}
