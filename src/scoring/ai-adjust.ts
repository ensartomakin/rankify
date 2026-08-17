export type AdjustMatchField = 'category' | 'name' | 'code';

export interface KeepOutOfTopRule {
  type: 'keep_out_of_top';
  matchField: AdjustMatchField;
  matchValue: string;
  topN: number;
  description: string;
}

export interface KeepInTopRule {
  type: 'keep_in_top';
  matchField: AdjustMatchField;
  matchValue: string;
  topN: number;
  description: string;
}

export interface PinProductRule {
  type: 'pin_product';
  productCode: string;
  position: number;
  description: string;
}

export type AdjustRule = KeepOutOfTopRule | KeepInTopRule | PinProductRule;

export interface AdjustableProduct {
  productCode: string;
  productName: string;
  categoryPath: string;
  isDisqualified: boolean;
  finalRank: number;
}

function buildMatcher<T extends AdjustableProduct>(
  field: AdjustMatchField,
  value: string
): (p: T) => boolean {
  const needle = value.trim().toLocaleLowerCase('tr-TR');
  if (!needle) return () => false;
  switch (field) {
    case 'category':
      return p => p.categoryPath.toLocaleLowerCase('tr-TR').includes(needle);
    case 'name':
      return p => p.productName.toLocaleLowerCase('tr-TR').includes(needle);
    case 'code':
      return p => {
        const code = p.productCode.toLocaleLowerCase('tr-TR');
        return code === needle || code.startsWith(needle);
      };
  }
}

// İlk topN sıradan eşleşen ürünleri çıkarır; kalan sıra (eşleşmeyenler + geriye kalan eşleşenler)
// orijinal göreceli sırasını korur — yani diğer kriterlere göre sıralı kalırlar.
function applyKeepOutOfTop<T extends AdjustableProduct>(
  arr: T[],
  matches: (p: T) => boolean,
  topN: number
): T[] {
  const n = Math.max(0, Math.min(topN, arr.length));
  const unmatched = arr.filter(p => !matches(p));
  const head = unmatched.slice(0, n);
  const headSet = new Set(head);
  const tail = arr.filter(p => !headSet.has(p));
  return [...head, ...tail];
}

// İlk topN sırayı, mümkün olduğunca eşleşen ürünlerle doldurur (yetmezse eşleşmeyenlerle tamamlar).
// Baştaki grup içi ve kalan grup içi göreceli sıra korunur.
function applyKeepInTop<T extends AdjustableProduct>(
  arr: T[],
  matches: (p: T) => boolean,
  topN: number
): T[] {
  const n = Math.max(0, Math.min(topN, arr.length));
  const matched = arr.filter(matches);
  const unmatched = arr.filter(p => !matches(p));
  const headMatched = matched.slice(0, n);
  const remaining = n - headMatched.length;
  const headUnmatched = remaining > 0 ? unmatched.slice(0, remaining) : [];
  const headSet = new Set<T>([...headMatched, ...headUnmatched]);
  const head = arr.filter(p => headSet.has(p));
  const tail = arr.filter(p => !headSet.has(p));
  return [...head, ...tail];
}

function applyPinProduct<T extends AdjustableProduct>(
  arr: T[],
  productCode: string,
  position: number
): T[] {
  const idx = arr.findIndex(p => p.productCode === productCode);
  if (idx === -1) return arr;
  const item = arr[idx];
  const rest = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
  const pos = Math.max(1, Math.min(position, arr.length));
  return [...rest.slice(0, pos - 1), item, ...rest.slice(pos - 1)];
}

/**
 * Verilen kuralları sırasıyla uygular ve finalRank'i yeniden hesaplar.
 * Kurallar, önceki kuralın çıktısı üzerine uygulanır — birikimli çalışır.
 */
export function applyAdjustRules<T extends AdjustableProduct>(
  products: T[],
  rules: AdjustRule[]
): T[] {
  let arr = [...products].sort((a, b) => a.finalRank - b.finalRank);

  for (const rule of rules) {
    switch (rule.type) {
      case 'keep_out_of_top':
        arr = applyKeepOutOfTop(arr, buildMatcher(rule.matchField, rule.matchValue), rule.topN);
        break;
      case 'keep_in_top':
        arr = applyKeepInTop(arr, buildMatcher(rule.matchField, rule.matchValue), rule.topN);
        break;
      case 'pin_product':
        arr = applyPinProduct(arr, rule.productCode, rule.position);
        break;
    }
  }

  return arr.map((p, i) => ({ ...p, finalRank: i + 1 }));
}
