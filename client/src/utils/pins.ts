// Manuel sabitlemeler: ürün kodu → mağazadaki mutlak sıra (1'den başlar, dışlananlar dahil
// tüm liste). Sıralamanın EN SON adımıdır — kural bazlı sıra ve AI kurallarından sonra
// uygulanır, bu yüzden kullanıcının elle koyduğu sıra her zaman kazanır.
//
// Uç durumlar (kararlaştırıldığı gibi):
//  - Sabitlenmiş ürün dışlama kuralına takılıyorsa: pin kazanır, ürün sabit sırasına konur.
//  - Sabitlenmiş ürün listede yoksa (mağazadan/kategoriden silinmiş): atlanır; çağıran taraf
//    gerçek çalışmada pini kayıttan siler.
//  - Sabit sıra ürün sayısından büyükse: ürün en sona konur (birden fazlaysa sıralarına göre).
//
// NOT: src/scoring/pins.ts (sunucu) bu fonksiyonun birebir aynısıdır — ekran anında
// güncelleme için bu kopyayı kullanır; değişiklikler iki dosyaya birlikte yapılmalı.

export type Pins = Record<string, number>;

export interface PinResult<T> {
  order:         T[];
  missing:       { code: string; position: number }[];
  overflow:      { code: string; position: number; total: number }[];
  pinnedExcluded: T[];
}

export function applyPins<T extends { productCode: string; isDisqualified: boolean }>(
  order: T[],
  pins: Pins,
): PinResult<T> {
  const codes = new Set(order.map(p => p.productCode));
  const missing = Object.entries(pins)
    .filter(([code]) => !codes.has(code))
    .map(([code, position]) => ({ code, position }));

  const isPinned = (p: T) => pins[p.productCode] !== undefined;
  const total  = order.length;
  const rest   = order.filter(p => !isPinned(p));
  const pinned = order
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isPinned(p))
    .sort((a, b) => (pins[a.p.productCode] - pins[b.p.productCode]) || (a.i - b.i))
    .map(({ p }) => p);

  const result = [...rest];
  const tail: T[] = [];
  const overflow: PinResult<T>['overflow'] = [];
  for (const p of pinned) {
    const position = pins[p.productCode];
    if (position > total) {
      overflow.push({ code: p.productCode, position, total });
      tail.push(p);
      continue;
    }
    const idx = position - 1;
    if (idx >= result.length) result.push(p);
    else result.splice(idx, 0, p);
  }
  result.push(...tail);

  return { order: result, missing, overflow, pinnedExcluded: pinned.filter(p => p.isDisqualified) };
}
