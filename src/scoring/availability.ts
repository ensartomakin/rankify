import type { TSoftVariant } from '../types/tsoft';
import type { SizeAvailability } from '../types/product';

export function computeSizeAvailability(
  variants: TSoftVariant[],
  threshold: number
): SizeAvailability {
  // Varyant verisi hiç gelmediyse güvenli default
  if (!variants || variants.length === 0) {
    return {
      totalVariants: 0,
      inStockVariants: 0,
      availabilityRate: 0,
      totalStock: 0,
      isSingleSize: true,
      passesThreshold: false,
    };
  }

  // Tek varyant = tek beden ürün; eşik uygulanmaz
  if (variants.length === 1) {
    const hasStock = variants[0].stock > 0;
    return {
      totalVariants: 1,
      inStockVariants: hasStock ? 1 : 0,
      availabilityRate: hasStock ? 1 : 0,
      totalStock: variants[0].stock,
      isSingleSize: true,
      passesThreshold: hasStock,
    };
  }

  const totalStock     = variants.reduce((s, v) => s + v.stock, 0);
  const inStockVariants = variants.filter(v => v.stock > 0).length;
  const availabilityRate = inStockVariants / variants.length;

  return {
    totalVariants: variants.length,
    inStockVariants,
    availabilityRate,
    totalStock,
    isSingleSize: false,
    passesThreshold: availabilityRate >= threshold,
  };
}
