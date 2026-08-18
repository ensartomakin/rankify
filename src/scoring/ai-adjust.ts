import { getBaseName, SMART_MIX_GAP } from './smart-mix';

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

// Adayları verilen sırayla, her pozisyon için eligibleAt() kısıtını karşılayan ilk adayı
// seçerek yerleştirir. respace=true ise ayrıca aynı base name'e (Smart Mix) sahip bir ürünün
// son SMART_MIX_GAP pozisyonda tekrar etmemesine çalışır — kısıt tatmin edilemezse (zorunlu
// çakışma) sırayla gevşetilir: önce mix aralığı, sonra (asla olmaması gereken durumda) kısıt.
// Bu, keep_out_of_top gibi kuralların üst sıralardan çektiği "araya giren" ürünlerin
// Smart Mix'in oluşturduğu boşlukları taşımasını — yani eşleşen ürünlerin art arda
// gelmesini — önler.
function placeRespectingRule<T extends AdjustableProduct>(
  candidates: T[],
  eligibleAt: (p: T, position: number) => boolean,
  respace: boolean
): T[] {
  const result: T[] = [];
  const pool = [...candidates];

  while (pool.length > 0) {
    const position = result.length;
    const recentBases = respace
      ? new Set(result.slice(-SMART_MIX_GAP).map(p => getBaseName(p.productName)))
      : null;

    let idx = pool.findIndex(p =>
      eligibleAt(p, position) && (!recentBases || !recentBases.has(getBaseName(p.productName)))
    );
    if (idx === -1) idx = pool.findIndex(p => eligibleAt(p, position));
    if (idx === -1) {
      // Hiçbir aday pozisyon kısıtını karşılamıyor — zorunlu çakışma, kalanları olduğu gibi ekle
      result.push(...pool.splice(0));
      break;
    }
    result.push(...pool.splice(idx, 1));
  }

  return result;
}

// İlk topN sıradan eşleşen ürünleri çıkarır; kalanlar diğer kriterlere göre aldıkları
// göreceli sırayı korur. respace=true ise Smart Mix aralığı da yeniden sağlanır.
function applyKeepOutOfTop<T extends AdjustableProduct>(
  arr: T[],
  matches: (p: T) => boolean,
  topN: number,
  respace: boolean
): T[] {
  const n = Math.max(0, Math.min(topN, arr.length));
  return placeRespectingRule(arr, (p, pos) => pos >= n || !matches(p), respace);
}

// İlk topN sırayı, mümkün olduğunca eşleşen ürünlerle doldurur (yetmezse eşleşmeyenlerle tamamlar).
// Baştaki grup içi ve kalan grup içi göreceli sıra korunur. respace=true ise Smart Mix aralığı
// bu sıralama üzerine ayrıca yeniden sağlanır.
function applyKeepInTop<T extends AdjustableProduct>(
  arr: T[],
  matches: (p: T) => boolean,
  topN: number,
  respace: boolean
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
  const ordered = [...head, ...tail];
  return respace ? placeRespectingRule(ordered, () => true, true) : ordered;
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

export interface ApplyAdjustRulesOptions {
  // Önizleme Smart Mix ile üretildiyse true geçin — aksi halde kural uygulamaları
  // (özellikle keep_out_of_top) Smart Mix'in oluşturduğu boşlukları taşıyıp aynı ürünün
  // varyantlarını art arda getirebilir. pin_product bu ayardan etkilenmez — açık bir
  // sabitleme isteği olduğu için diğer kuralları geçersiz kılması beklenir.
  respaceSameProduct?: boolean;
}

/**
 * Verilen kuralları sırasıyla uygular ve finalRank'i yeniden hesaplar.
 * Kurallar, önceki kuralın çıktısı üzerine uygulanır — birikimli çalışır.
 */
export function applyAdjustRules<T extends AdjustableProduct>(
  products: T[],
  rules: AdjustRule[],
  options: ApplyAdjustRulesOptions = {}
): T[] {
  const respace = options.respaceSameProduct ?? false;
  let arr = [...products].sort((a, b) => a.finalRank - b.finalRank);

  for (const rule of rules) {
    switch (rule.type) {
      case 'keep_out_of_top':
        arr = applyKeepOutOfTop(arr, buildMatcher(rule.matchField, rule.matchValue), rule.topN, respace);
        break;
      case 'keep_in_top':
        arr = applyKeepInTop(arr, buildMatcher(rule.matchField, rule.matchValue), rule.topN, respace);
        break;
      case 'pin_product':
        arr = applyPinProduct(arr, rule.productCode, rule.position);
        break;
    }
  }

  return arr.map((p, i) => ({ ...p, finalRank: i + 1 }));
}
