import type { NormalizedProduct } from '../types/product';

/**
 * Tüm renk/varyant tanımlayıcıları — tek kelime ve çok kelimeli ifadeler (küçük harf).
 * Ürün adının sonundan bu ifadeler sıyrılarak "base name" elde edilir.
 */
const COLOR_PHRASES = new Set<string>([
  // ── Nötr / Bej ailesi ──
  'krem', 'bej', 'vizon', 'taş', 'bisküvi', 'latte', 'beji', 'kemik', 'nude', 'kaju',
  'natural', 'naturel', 'ten', 'ekru', 'tebeşir', 'parşömen', 'fildişi', 'kırçıllı',
  'fındık kabuğu', 'deniz kabuğu', 'bal köpüğü', 'ten rengi', 'kum beji',
  'açık badem', 'soft kaşmir', 'bej-vizon', 'çakıl taşı', 'açık taş', 'açık kil',
  'mat vizon', 'tozlu vizon', 'küllü bej', 'istiridye',
  'koyu vizon', 'koyu bej', 'açık vizon', 'açık bej',
  // ── Beyaz ailesi ──
  'beyaz', 'kırık beyaz', 'fildişi', 'fil dişi', 'optik beyaz', 'optik',
  // ── Siyah ──
  'siyah', 'siyah-tan',
  // ── Gri ailesi ──
  'gri', 'füme', 'duman', 'sis', 'antrasit', 'melanj',
  'duman gri', 'gri melanj', 'grimelanj', 'koyu gri', 'açık gri', 'qa gri',
  'soft gri', 'açık sis', 'buhar gri', 'küllü gri', 'antrasit-duman',
  // ── Kahve / Toprak ailesi ──
  'camel', 'taba', 'kahve', 'tarçın', 'karamel', 'toprak', 'kestane', 'browni',
  'zencefil', 'fındık', 'mocha', 'kimyon', 'acı kahve', 'tozlu kahve', 'koyu kahve',
  'çikolata', 'bitter', 'trüf', 'bark', 'cappucino',
  'qa camel', 'sütlü kahve', 'açık mocha', 'açık fındık', 'kahverengi',
  'ceviz kabuğu', 'koyu taba', 'koyu fındık', 'açık kimyon', 'açık camel',
  'açık taba', 'kahve çekirdeği', 'koyu camel', 'sıcak kahve', 'açık kahve',
  // ── Kırmızı / Bordo ailesi ──
  'vişne', 'bordo', 'kırmızı', 'begonvil', 'kiraz', 'nar', 'cherry',
  'vişne çürüğü', 'koyu vişne', 'açık bordo',
  // ── Mavi / Lacivert ailesi ──
  'lacivert', 'mavi', 'indigo', 'mavisi', 'safir', 'aqua', 'denim', 'jean',
  'ofis lacivert', 'kot mavi', 'koyu mavi', 'gece mavisi', 'gece mavi',
  'koyu kot mavi', 'naval mavi', 'bebe mavi', 'açık mavi', 'gök mavisi', 'gök mavi',
  'petrol', 'lavanta mavi', 'orta mavi', 'buz mavi', 'ufuk mavi', 'pastel mavi',
  'sisli mavi', 'retro mavi', 'koyu lacivert', 'taşlanmış mavi', 'floral mavi',
  'soft mavi', 'mavi-yeşil',
  // ── Mor / Lila ailesi ──
  'mor', 'lila', 'leylak', 'lavanta', 'eflatun', 'violet', 'mürdüm', 'menekşe',
  'mürver', 'orkide', 'saks', 'çivit',
  'soft lila', 'açık lila', 'tozlu mürdüm', 'açık menekşe', 'soft menekşe',
  'açık leylak', 'açık lavanta', 'soft lavanta', 'koyu mürdüm bordo',
  'açık mürver', 'koyu mürdüm', 'pastel violet', 'retro violet', 'koyu lavanta',
  // ── Pembe / Gül ailesi ──
  'pembe', 'pudra', 'pembesi', 'gül', 'rose', 'fuşya', 'yavruağzı',
  'soft pembe', 'soft pudra', 'pastel pembe', 'gül kurusu', 'gül tozu',
  'açık gül tozu', 'toz pembe', 'açık gül', 'pembe-kırmızı',
  // ── Sarı / Hardal ailesi ──
  'sarı', 'hardal', 'limon', 'saman', 'safran', 'kehribar', 'amber', 'vanilya',
  'kasımpatı', 'zerdeçal',
  'pastel sarı', 'açık sarı', 'asit sarı', 'soft sarı', 'soft limon',
  'tereyağ sarısı', 'tereyağı', 'tereyağ', 'açık vanilya',
  // ── Turuncu / Somon ailesi ──
  'kiremit', 'mercan', 'somon', 'kavun', 'şeftali', 'portakal', 'oranj', 'kayısı',
  'papaya', 'turuncu', 'mango',
  'bal kabağı', 'kavun içi', 'nar çiçeği', 'açık somon', 'şeftali tüyü',
  'açık şeftali', 'pastel somon', 'pastel mercan', 'koyu somon', 'koyu mango',
  // ── Yeşil ailesi ──
  'haki', 'çağla', 'yeşil', 'yaprak', 'mint', 'çimen', 'orman', 'zümrüt', 'çam',
  'olive', 'kaktüs', 'adaçayı', 'zeytin', 'okyanus', 'okaliptüs', 'okaliptus',
  'yosun', 'pesto', 'ardıç', 'selvi', 'avokado', 'kivi', 'yeşili',
  'fıstık yeşili', 'asit yeşili', 'yağ yeşili', 'su yeşili', 'nil yeşili',
  'asit yeşil', 'tozlu çağla', 'zümrüt yeşili', 'açık haki', 'defne',
  'küf yeşili', 'koyu çağla', 'açık yeşil', 'pastel fıstık', 'orman yeşili',
  'koyu çimen', 'mat adaçayı', 'avokado yeşil', 'yosun yeşili',
  'pastel okaliptüs', 'açık olive', 'açık adaçayı', 'floral yağ yeşili',
  'koyu haki', 'koyu adaçayı', 'soft yeşil', 'elbise yağ yeşili',
  // ── Metalik ──
  'dore', 'bakır', 'silver', 'bronz', 'gold', 'sedef', 'sedef broş',
  // ── Desen / Pattern ──
  'leopar', 'kareli', 'çizgili', 'patchwork', 'desenli', 'renkli', 'etnik',
  'etnik desen', 'brush çiçek', 'geometrik desen', 'retro çiçek',
  'karma şal', 'bohem şal', 'pötikare', 'karanfil', 'raya', 'vera',
  'bloomix', 'calypso', 'caliypso', 'melonia', 'fractal', 'glitzy',
  'papatya', 'palmera', 'tropical', 'dotta', 'rustica',
  // ── Kombinasyon renkleri (tek kelime/tire birleşik) ──
  'siyah ekru', 'vizon kemik', 'ofis lacivert ekru',
  'bej-turuncu', 'kırık beyaz-kimyon', 'kırık beyaz-pembe',
  'siyah-ekru', 'kahve-ekru', 'ofis lacivert-ekru', 'acı kahve-bej',
  'bej-bordo', 'lacivert-gri', 'siyah-beyaz', 'beyaz-bordo', 'beyaz-lacivert',
  'bej-acı kahve', 'beyaz-siyah', 'bej-hardal', 'beyaz-haki', 'beyaz-kırmızı',
  'beyaz-acı kahve', 'bordo-beyaz', 'gri-bordo',
  'kiremit-lacivert', 'bordo-gri', 'lacivert-acı kahve', 'acı kahve-ekru',
  'açık bej-siyah', 'açık bej-mint', 'açık bej-hardal', 'koyu bej-turuncu',
  'çağla-bej', 'mint-beyaz', 'kırmızı-lacivert-sarı', 'gri siyah',
  'bej-ekru', 'ekru-bordo', 'yosun-acı kahve', 'ekru-kahve',
  'bordo-acı kahve', 'gri-ekru', 'acı kahve-koyu lacivert',
  'kemik-kahve', 'kahve-buz mavi', 'açık gri-soft sarı', 'kemik-siyah',
  'yosun-bordo', 'kahve-bordo', 'tereyağı-yosun', 'karışık',
]);

/**
 * Ürün adından trailing renk/varyant ifadelerini silerek base name döndürür.
 * Önce 3 kelimelik, sonra 2, sonra 1 kelimelik sona bakılır — en uzun eşleşme önce sıyrılır.
 * Döngülü: birden fazla trailing token sıyrılabilir (ör. "Şal Açık Vizon Kemik" → "şal").
 */
export function getBaseName(productName: string): string {
  const lower = productName.toLowerCase().trim();
  const words = lower.split(/\s+/);
  if (words.length <= 1) return lower;

  let end = words.length;

  // Sona doğru renk tokenlarını iteratif soy
  let changed = true;
  while (changed && end > 1) {
    changed = false;
    for (let len = Math.min(3, end - 1); len >= 1; len--) {
      const phrase = words.slice(end - len, end).join(' ');
      if (COLOR_PHRASES.has(phrase)) {
        end -= len;
        changed = true;
        break;
      }
    }
  }

  return words.slice(0, end).join(' ');
}

/**
 * Smart Mix: aynı base name'e sahip ürünlerin yan yana gelmesini engeller.
 * Greedy: her pozisyon için öncekiyle farklı base name'li en iyi skoru seç.
 * Disqualified ürünlere dokunmaz; sona bırakır.
 */
export function applySmartMix(products: NormalizedProduct[]): NormalizedProduct[] {
  const qualified    = products.filter(p => !p.isDisqualified);
  const disqualified = products.filter(p => p.isDisqualified);

  if (qualified.length <= 1) return products;

  const result: NormalizedProduct[] = [];
  const pool = [...qualified];

  while (pool.length > 0) {
    const prevBase = result.length > 0
      ? getBaseName(result[result.length - 1].productName)
      : null;

    const idx = pool.findIndex(p => getBaseName(p.productName) !== prevBase);

    if (idx === -1) {
      result.push(...pool.splice(0));
    } else {
      result.push(...pool.splice(idx, 1));
    }
  }

  return [
    ...result.map((p, i) => ({ ...p, finalRank: i + 1 })),
    ...disqualified,
  ];
}
