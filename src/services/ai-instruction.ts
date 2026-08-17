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

const responseSchema = z.object({
  rules: z.array(adjustRuleSchema).max(10),
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
          topN: {
            type: 'NUMBER',
            description: 'keep_out_of_top / keep_in_top için: kuralın uygulanacağı ilk N sıra',
          },
          productCode: {
            type: 'STRING',
            description: 'pin_product için: sabitlenecek ürün kodu',
          },
          position: {
            type: 'NUMBER',
            description: 'pin_product için: ürünün sabitleneceği 1 tabanlı sıra',
          },
          description: {
            type: 'STRING',
            description: 'Kuralın ne yaptığını özetleyen kısa Türkçe cümle (kullanıcıya gösterilecek)',
          },
        },
        required: ['type', 'description'],
      },
    },
  },
  required: ['rules'],
};

function buildSystemPrompt(categoryPaths: string[], totalProducts: number): string {
  const sample = categoryPaths.slice(0, 200);
  return `Sen bir e-ticaret ürün sıralama asistanısın. Kullanıcı, bir kategori sayfasındaki ürün sıralamasını doğal dil talimatlarıyla düzenlemek istiyor.
Elindeki listede toplam ${totalProducts} ürün var. Ürünlerin kategori yolları (categoryPath) arasında şu örnekler bulunuyor:
${sample.map(c => `- ${c}`).join('\n') || '(kategori bilgisi yok)'}

Kullanıcının talimatını, verilen şemaya uyan bir "rules" dizisine çevir. Kural tipleri:
- keep_out_of_top: matchField/matchValue ile eşleşen ürünler ilk topN sırada YER ALMASIN. topN'den sonra, eşleşen ürünler diğer kriterlere göre aldıkları sırayı korur.
- keep_in_top: matchField/matchValue ile eşleşen ürünler mümkün olduğunca ilk topN sırada yer alsın.
- pin_product: belirli bir productCode'u tam olarak position sırasına sabitle.

matchField 'category' iken matchValue, yukarıdaki categoryPath örneklerinden birinde GEÇEN kısa bir alt dize olmalı (örn. "Çanta"), tüm yolu kopyalama. matchField 'name' ürün adında geçmesi beklenen bir kelime, 'code' ise ürün kodu ya da öneki içindir.
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
  context: { categoryPaths: string[]; totalProducts: number }
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
        systemInstruction: { parts: [{ text: buildSystemPrompt(context.categoryPaths, context.totalProducts) }] },
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

  if (parsed.data.rules.length === 0) {
    throw new AiInstructionError('Talimat sıralamayla ilgili bir kurala çevrilemedi');
  }

  // Model'in halüsinasyon üretme ihtimaline karşı sayısal alanları veri boyutuna göre kelepçele
  const clampCount = (n: number) => Math.max(1, Math.min(Math.round(n), Math.max(context.totalProducts, 1)));

  return parsed.data.rules.map((r): AdjustRule => {
    if (r.type === 'pin_product') {
      return { ...r, position: clampCount(r.position) };
    }
    return { ...r, topN: clampCount(r.topN) };
  });
}
