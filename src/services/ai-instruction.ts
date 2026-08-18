import { z } from 'zod';
import { logger } from '../utils/logger';
import type { AdjustRule } from '../scoring/ai-adjust';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class AiInstructionError extends Error {}

export const adjustRuleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('keep_out_of_top'),
    matchField: z.enum(['category', 'name', 'code']),
    matchValue: z.string().trim().min(1).max(200),
    topN: z.number().finite(),
    description: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal('keep_in_top'),
    matchField: z.enum(['category', 'name', 'code']),
    matchValue: z.string().trim().min(1).max(200),
    topN: z.number().finite(),
    description: z.string().trim().min(1).max(300),
  }),
  z.object({
    type: z.literal('pin_product'),
    productCode: z.string().trim().min(1).max(200),
    position: z.number().finite(),
    description: z.string().trim().min(1).max(300),
  }),
]);

// Modele verilen "tel" (wire) şema: topN/position ayrımını modelin tutarlı biçimde
// karıştırdığı gözlemlendi (bazen ikisi arasında rastgele geçiş, bazen 0 dolduruyordu).
// Tek, her zaman zorunlu bir 'amount' alanı kullanmak gözlemsel olarak çok daha güvenilir —
// aşağıda internal AdjustRule şekline (topN ya da position) tip bazlı eşleniyor.
const wireRuleSchema = z.object({
  type: z.enum(['keep_out_of_top', 'keep_in_top', 'pin_product']),
  matchField: z.enum(['category', 'name', 'code']).optional(),
  matchValue: z.string().trim().min(1).max(200).optional(),
  productCode: z.string().trim().min(1).max(200).optional(),
  amount: z.number().finite(),
  description: z.string().trim().min(1).max(300),
});

const responseSchema = z.object({
  rules: z.array(wireRuleSchema).max(10),
});

// Gemini'nin responseSchema alanı OpenAPI şemasının bir alt kümesini kullanır (tip adları büyük harfli).
const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    rules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: {
            type: 'STRING',
            enum: ['keep_out_of_top', 'keep_in_top', 'pin_product'],
            description: 'Kural tipi',
          },
          matchField: {
            type: 'STRING',
            enum: ['category', 'name', 'code'],
            description: 'keep_out_of_top / keep_in_top için: eşleştirme yapılacak alan',
          },
          matchValue: {
            type: 'STRING',
            description: 'keep_out_of_top / keep_in_top için: aranacak alt dize (kategori yolu, ürün adı ya da kod)',
          },
          productCode: {
            type: 'STRING',
            description: 'pin_product için: sabitlenecek ürün kodu',
          },
          amount: {
            type: 'NUMBER',
            description: 'pin_product için: ürünün sabitleneceği 1 tabanlı sıra. keep_out_of_top/keep_in_top için: kuralın uygulanacağı ilk N sıra. Her kural tipinde ZORUNLU, asla boş bırakma.',
          },
          description: {
            type: 'STRING',
            description: 'Kuralın ne yaptığını özetleyen kısa Türkçe cümle (kullanıcıya gösterilecek)',
          },
        },
        required: ['type', 'description', 'amount'],
      },
    },
  },
  required: ['rules'],
};

const MAX_ORDER_LISTING = 500;

function buildSystemPrompt(
  categoryPaths: string[],
  totalProducts: number,
  orderedProducts: { finalRank: number; productCode: string; productName: string }[]
): string {
  const sample = categoryPaths.slice(0, 200);
  const listed = orderedProducts.slice(0, MAX_ORDER_LISTING);
  const orderListing = listed
    .map(p => `${p.finalRank} — ${p.productCode} — ${p.productName}`)
    .join('\n');
  const truncatedNote = orderedProducts.length > MAX_ORDER_LISTING
    ? `\n(Not: sadece ilk ${MAX_ORDER_LISTING} sıra listelendi, sonrası için sıra numarası referansı çözülemez.)`
    : '';

  return `Sen bir e-ticaret ürün sıralama asistanısın. Kullanıcı, bir kategori sayfasındaki ürün sıralamasını doğal dil talimatlarıyla düzenlemek istiyor.
Elindeki listede toplam ${totalProducts} ürün var. Ürünlerin kategori yolları (categoryPath) arasında şu örnekler bulunuyor:
${sample.map(c => `- ${c}`).join('\n') || '(kategori bilgisi yok)'}

Mevcut sıralama (sıra — ürün kodu — ürün adı):
${orderListing || '(sıra bilgisi yok)'}${truncatedNote}

Kullanıcının talimatını, verilen şemaya uyan bir "rules" dizisine çevir. Bir talimat birden fazla kurala karşılık gelebilir — hepsini ayrı ayrı diziye ekle, hiçbirini atlama. Her kuralda 'amount' adında tek bir sayısal alan var — bu alan HER kural tipinde ZORUNLUDUR, asla boş bırakma:
- keep_out_of_top: matchField/matchValue ile eşleşen ürünler ilk 'amount' sırada YER ALMASIN. Bu sıradan sonra, eşleşen ürünler diğer kriterlere göre aldıkları sırayı korur.
- keep_in_top: matchField/matchValue ile eşleşen ürünler mümkün olduğunca ilk 'amount' sırada yer alsın.
- pin_product: belirli bir productCode'u tam olarak 'amount'ıncı sıraya sabitle.

matchField 'category' iken matchValue, yukarıdaki categoryPath örneklerinden birinde GEÇEN kısa bir alt dize olmalı (örn. "Çanta"), tüm yolu kopyalama. matchField 'name' ürün adında geçmesi beklenen bir kelime, 'code' ise ürün kodu ya da öneki içindir.

Kullanıcı bir ürünü kendi sırasına göre işaret ederse ("1. sıradaki ürün", "5. sıradakini", "en üstteki ürün", "3. ürün" gibi), yukarıdaki "Mevcut sıralama" listesinden o sıradaki gerçek productCode'u bul ve pin_product kuralında KESİNLİKLE o gerçek kodu kullan — asla kod uydurma; listede yoksa o kuralı atla. "X'i Y sırasına al" gibi birden fazla taşıma isteği varsa, her biri için kaynak sıradaki ürünün MEVCUT LİSTEDEKİ (taşımalar uygulanmadan önceki) koduna göre ayrı bir pin_product kuralı üret — kurallar sırayla uygulanacağı için bu, istenen sonucu (örn. bir nevi yer değiştirme) doğru verir.

Her kural için description alanına, kuralın ne yaptığını özetleyen kısa bir Türkçe cümle yaz.
Talimat anlamsızsa, sıralamayla ilgisizse ya da verilen bilgilerle uygulanamıyorsa boş bir rules dizisi döndür — kural uydurma.
Sadece şemaya uyan JSON döndür, başka hiçbir metin ekleme.`;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export async function parseInstructionToRules(
  instruction: string,
  context: {
    categoryPaths: string[];
    totalProducts: number;
    orderedProducts: { finalRank: number; productCode: string; productName: string }[];
  }
): Promise<AdjustRule[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiInstructionError('AI özelliği yapılandırılmamış: GEMINI_API_KEY eksik');
  }

  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(context.categoryPaths, context.totalProducts, context.orderedProducts) }] },
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: geminiResponseSchema,
          temperature: 0,
        },
      }),
    });
  } catch (e) {
    throw new AiInstructionError(`AI servisine ulaşılamadı: ${e instanceof Error ? e.message : e}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error(`[ai-instruction] Gemini API hatası ${res.status}: ${body}`);
    throw new AiInstructionError(`AI servisi hata döndü (${res.status})`);
  }

  const data = await res.json() as GeminiResponse;
  if (data.promptFeedback?.blockReason) {
    throw new AiInstructionError('Talimat AI tarafından reddedildi');
  }

  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text.trim()) {
    throw new AiInstructionError('AI talimatı yorumlayamadı');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    logger.warn(`[ai-instruction] JSON parse edilemedi: ${text}`);
    throw new AiInstructionError('AI geçersiz bir yanıt üretti, talimatı daha net ifade etmeyi deneyin');
  }

  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn(`[ai-instruction] geçersiz kural şeması: ${text}`);
    throw new AiInstructionError('AI geçersiz bir kural üretti, talimatı daha net ifade etmeyi deneyin');
  }

  // pin_product için matchField/matchValue yerine productCode gerekir, tersi de geçerli —
  // eksik zorunlu alanlı satırları (model hatası) sessizce ele
  const knownCodes = new Set(context.orderedProducts.map(p => p.productCode));
  const clampCount = (n: number) => Math.max(1, Math.min(Math.round(n), Math.max(context.totalProducts, 1)));

  const validRules: AdjustRule[] = [];
  for (const r of parsed.data.rules) {
    if (r.type === 'pin_product') {
      if (!r.productCode) { logger.warn('[ai-instruction] pin_product için productCode eksik, atlandı'); continue; }
      if (!knownCodes.has(r.productCode)) {
        logger.warn(`[ai-instruction] bilinmeyen productCode üretildi, kural atlandı: ${r.productCode}`);
        continue;
      }
      validRules.push({ type: 'pin_product', productCode: r.productCode, position: clampCount(r.amount), description: r.description });
    } else {
      if (!r.matchField || !r.matchValue) { logger.warn(`[ai-instruction] ${r.type} için matchField/matchValue eksik, atlandı`); continue; }
      validRules.push({ type: r.type, matchField: r.matchField, matchValue: r.matchValue, topN: clampCount(r.amount), description: r.description });
    }
  }

  if (validRules.length === 0) {
    throw new AiInstructionError('Talimat sıralamayla ilgili bir kurala çevrilemedi');
  }

  return validRules;
}
