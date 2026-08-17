import { useState } from 'react';
import { CategoryPicker } from '../components/CategoryPicker';
import {
  previewRanking, aiAdjustRanking, applyManualRanking,
  type ProductPreviewItem, type PreviewResponse, type AdjustRule,
} from '../api/ranking';
import { CRITERION_LABELS, type CriterionKey } from '../types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtPct(n: number) {
  return '%' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Try multiple T-Soft image URL patterns */
function buildImageUrls(apiUrl: string, product: ProductPreviewItem): string[] {
  const base = apiUrl.replace(/\/$/, '');
  const urls: string[] = [];
  // Prefer numeric productId for image lookup
  if (product.productId) {
    urls.push(`${base}/img/products/b/${product.productId}_1.jpg`);
    urls.push(`${base}/img/products/${product.productId}_1.jpg`);
  }
  // Fallback: strip leading "T" prefix from productCode
  const stripped = product.productCode.replace(/^[Tt]/, '');
  if (stripped !== product.productId) {
    urls.push(`${base}/img/products/b/${stripped}_1.jpg`);
  }
  // Raw productCode
  urls.push(`${base}/img/products/b/${product.productCode}_1.jpg`);
  return urls;
}

interface ChatMessage {
  role:     'user' | 'assistant';
  text:     string;
  isError?: boolean;
}

interface CardProps {
  product:  ProductPreviewItem;
  criteria: PreviewResponse['criteria'];
  apiUrl:   string;
}

function ProductCard({ product, criteria, apiUrl }: CardProps) {
  const imageUrls = buildImageUrls(apiUrl, product);
  const [urlIdx, setUrlIdx] = useState(0);

  const currentUrl = imageUrls[urlIdx] ?? null;
  const allFailed  = urlIdx >= imageUrls.length;

  const productUrl = `${apiUrl.replace(/\/$/, '')}/urun-detay/${product.productCode}`;

  return (
    <div className="rounded-2xl flex flex-col overflow-hidden transition-all duration-150 hover:shadow-md"
      style={{
        background: 'var(--surface)',
        border: product.isDisqualified
          ? '1.5px solid var(--err-bd)'
          : '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>

      {/* Top bar: rank + code */}
      <div className="flex items-center justify-between px-3 py-2 gap-2"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: product.isDisqualified ? 'var(--err-bg)' : 'var(--acc-bg)',
              color:      product.isDisqualified ? 'var(--err-tx)' : 'var(--acc-tx)',
            }}>
            Sıra: {product.finalRank}
          </span>
          {product.isDisqualified && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'var(--err-bg)', color: 'var(--err-tx)' }}>✕</span>
          )}
        </div>
        <span className="text-[11px] font-mono flex items-center gap-1 min-w-0" style={{ color: 'var(--tx3)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 shrink-0">
            <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            <circle cx="5" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="19" r="1"/>
          </svg>
          <span className="truncate">{product.productCode}</span>
        </span>
      </div>

      {/* Image */}
      <div className="relative flex items-center justify-center overflow-hidden"
        style={{ height: '200px', background: 'var(--surface2)' }}>
        {!allFailed && currentUrl ? (
          <img
            key={currentUrl}
            src={currentUrl}
            alt={product.productName}
            onError={() => setUrlIdx(i => i + 1)}
            className="h-full w-full object-contain"
            style={{ display: 'block' }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5" style={{ color: 'var(--border-2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-12 h-12">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="px-3 pt-2.5 pb-1.5">
        <a href={productUrl} target="_blank" rel="noopener noreferrer"
          className="text-[13px] font-semibold leading-snug line-clamp-2 hover:underline"
          style={{ color: 'var(--acc-tx)' }}>
          {product.productName || product.productCode}
        </a>
      </div>

      {/* Score table */}
      <div className="px-3 pb-2 flex-1">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {criteria.map(c => {
            const key = c.key as CriterionKey;
            let rawVal: string | number = '';

            if (key === 'stockScore')        rawVal = product.totalStock.toLocaleString('tr-TR');
            else if (key === 'bestSeller')   rawVal = product.salesQty.toLocaleString('tr-TR');
            else if (key === 'newness')      rawVal = fmtDate(product.registrationDate);
            else if (key === 'reviewScore')  rawVal = product.reviewCount.toLocaleString('tr-TR');
            else if (key === 'availabilityScore') rawVal = fmtPct(product.availabilityRate * 100);

            const label = key === 'bestSeller' ? 'Satış adedi (2 hafta)' : CRITERION_LABELS[key];
            const contrib = product.criteriaContributions[key] ?? 0;

            return (
              <div key={key} className="flex items-baseline justify-between px-2.5 py-1.5 text-[12px]"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--tx2)' }}>
                  {label}: <span style={{ color: 'var(--tx1)', fontWeight: 500 }}>{rawVal}</span>
                </span>
                <span className="font-semibold tabular-nums ml-2 shrink-0" style={{ color: 'var(--tx1)' }}>
                  {fmtPct(contrib)}
                </span>
              </div>
            );
          })}
          {/* Total */}
          <div className="flex items-center justify-between px-2.5 py-2 text-[13px] font-bold"
            style={{ background: 'var(--acc-bg)' }}>
            <span style={{ color: 'var(--tx1)' }}>Toplam</span>
            <span style={{ color: 'var(--acc-tx)' }}>{fmtPct(product.rankingScore)}</span>
          </div>
        </div>

        {product.isDisqualified && product.disqualifyReason && (
          <p className="text-[11px] mt-1.5 px-0.5" style={{ color: 'var(--err-tx)' }}>
            ⚠ {product.disqualifyReason}
          </p>
        )}

        <p className="text-[11px] mt-1.5 px-0.5" style={{ color: 'var(--tx3)' }}>
          {fmtDate(product.registrationDate)}
        </p>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[11px] font-mono" style={{ color: 'var(--tx3)' }}>
          #{product.productCode}
        </span>
        <a href={productUrl} target="_blank" rel="noopener noreferrer"
          className="text-[12px] font-semibold hover:underline"
          style={{ color: 'var(--acc-tx)' }}>
          Ürünü Gör →
        </a>
      </div>
    </div>
  );
}

export function Products() {
  const [categoryId,   setCategoryId]   = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [result,       setResult]       = useState<PreviewResponse | null>(null);
  const [filter,       setFilter]       = useState('');
  const [showDq,       setShowDq]       = useState(true);

  // AI destekli sıralama düzenleme (yüzen sohbet paneli)
  const [baseProducts,  setBaseProducts]  = useState<ProductPreviewItem[] | null>(null);
  const [rules,         setRules]         = useState<AdjustRule[]>([]);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading,     setAiLoading]     = useState(false);
  const [applyLoading,  setApplyLoading]  = useState(false);

  async function handleLoad() {
    if (!categoryId) return;
    setLoading(true); setError(''); setResult(null); setFilter('');
    setBaseProducts(null); setRules([]); setMessages([]); setAiInstruction('');
    try {
      const data = await previewRanking({ categoryId });
      setResult(data);
      setBaseProducts(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function handleAiInstruction() {
    const instruction = aiInstruction.trim();
    if (!instruction || !baseProducts || !categoryId || aiLoading) return;
    setAiLoading(true);
    setMessages(m => [...m, { role: 'user', text: instruction }]);
    setAiInstruction('');
    try {
      const resp = await aiAdjustRanking({ categoryId, products: baseProducts, rules, instruction });
      setRules(resp.rules);
      setResult(r => (r ? { ...r, products: resp.products } : r));
      const reply = resp.addedRules.length > 0
        ? resp.addedRules.map(r => r.description).join(' ')
        : 'Sıralama güncellendi.';
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Talimat uygulanamadı';
      setMessages(m => [...m, { role: 'assistant', text, isError: true }]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleRemoveRule(idx: number) {
    if (!baseProducts || !categoryId || aiLoading) return;
    const newRules = rules.filter((_, i) => i !== idx);
    if (newRules.length === 0) {
      setRules([]);
      setResult(r => (r ? { ...r, products: baseProducts } : r));
      return;
    }
    setAiLoading(true);
    try {
      const resp = await aiAdjustRanking({ categoryId, products: baseProducts, rules: newRules });
      setRules(resp.rules);
      setResult(r => (r ? { ...r, products: resp.products } : r));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Kural kaldırılamadı';
      setMessages(m => [...m, { role: 'assistant', text, isError: true }]);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApplyToTsoft() {
    if (!result || !categoryId || applyLoading) return;
    if (!window.confirm('Bu sıralama T-Soft mağazasındaki kategoriye canlı olarak uygulanacak. Emin misiniz?')) return;
    setApplyLoading(true);
    try {
      const items = result.products
        .filter(p => !p.isDisqualified)
        .map(p => ({ productCode: p.productCode, rank: p.finalRank }));
      await applyManualRanking(categoryId, items);
      setMessages(m => [...m, { role: 'assistant', text: 'Sıralama T-Soft’a uygulandı.' }]);
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Sıralama uygulanamadı';
      setMessages(m => [...m, { role: 'assistant', text, isError: true }]);
    } finally {
      setApplyLoading(false);
    }
  }

  const visible = result
    ? result.products
        .filter(p => showDq || !p.isDisqualified)
        .filter(p =>
          !filter.trim() ||
          p.productName.toLowerCase().includes(filter.toLowerCase()) ||
          p.productCode.toLowerCase().includes(filter.toLowerCase())
        )
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-8 pt-7 pb-4">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--tx1)' }}>
          Ürün Sıralaması
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--tx2)' }}>
          Kategori seçin, güncel puan dağılımı ve sıralamayı görün
        </p>
      </div>

      {/* Controls */}
      <div className="shrink-0 px-8 pb-4">
        <div className="flex items-end gap-3 max-w-2xl">
          <div className="flex-1">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--tx2)' }}>Kategori</label>
            <CategoryPicker
              value={categoryId}
              label={categoryName}
              onChange={(id, name) => { setCategoryId(id); setCategoryName(name); setResult(null); }}
            />
          </div>
          <button
            onClick={handleLoad}
            disabled={!categoryId || loading}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all shrink-0"
            style={!categoryId || loading
              ? { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)', cursor: 'not-allowed' }
              : { background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }
            }
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Yükleniyor…
              </span>
            ) : 'Yükle'}
          </button>
        </div>

        {error && (
          <div className="mt-3 max-w-2xl text-sm px-4 py-3 rounded-xl animate-fade-in"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            ✕ {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>
                {categoryName || categoryId}
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'Toplam',   val: result.total,             color: 'var(--tx2)',   bg: 'var(--surface)',  bd: 'var(--border)' },
                  { label: 'Aktif',    val: result.qualifiedCount,    color: 'var(--ok-tx)', bg: 'var(--ok-bg)',   bd: 'var(--ok-bd)'  },
                  { label: 'Dışlanan', val: result.disqualifiedCount, color: 'var(--err-tx)',bg: 'var(--err-bg)',  bd: 'var(--err-bd)' },
                ].map(s => (
                  <span key={s.label} className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.color }}>
                    {s.val} {s.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {result.disqualifiedCount > 0 && (
                <button onClick={() => setShowDq(v => !v)}
                  className="text-xs px-3 py-2 rounded-xl font-medium transition-colors"
                  style={{
                    background: showDq ? 'var(--err-bg)' : 'var(--surface)',
                    border: `1px solid ${showDq ? 'var(--err-bd)' : 'var(--border)'}`,
                    color: showDq ? 'var(--err-tx)' : 'var(--tx2)',
                  }}>
                  {showDq ? 'Dışlananları Gizle' : 'Dışlananları Göster'}
                </button>
              )}
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: 'var(--tx3)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" placeholder="Ad veya kod ara…"
                  value={filter} onChange={e => setFilter(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx1)', width: '180px' }}
                />
              </div>
            </div>
          </div>

          {/* Grid */}
          {visible.length === 0 ? (
            <div className="flex items-center justify-center h-40 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--tx3)' }}>Ürün bulunamadı</p>
            </div>
          ) : (
            <div className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
              {visible.map(p => (
                <ProductCard key={p.productCode} product={p} criteria={result.criteria} apiUrl={result.apiUrl} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--acc-bg)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--tx2)' }}>
            Sıralamayı görmek için bir kategori seçin ve Yükle'ye basın
          </p>
        </div>
      )}

      {/* AI sohbet — yüzen buton + panel */}
      {result && (
        <>
          <button
            onClick={() => setChatOpen(v => !v)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }}
          >
            {chatOpen ? (
              <span className="text-xl leading-none">✕</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            )}
            {!chatOpen && rules.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'var(--err-tx)', color: 'white' }}>
                {rules.length}
              </span>
            )}
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl flex flex-col overflow-hidden animate-fade-in"
              style={{
                height: '540px', maxHeight: 'calc(100vh - 140px)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              }}>

              {/* Başlık */}
              <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>AI Sıralama Asistanı</div>
                  <div className="text-[11px]" style={{ color: 'var(--tx3)' }}>{categoryName || categoryId}</div>
                </div>
                <button onClick={() => setChatOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 shrink-0"
                  style={{ color: 'var(--tx3)' }}>✕</button>
              </div>

              {/* Mesaj akışı */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
                {messages.length === 0 && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--tx3)' }}>
                    Sıralamayla ilgili bir talimat yazın, örn: <em>"ilk 100 sırada çanta kategorisinden ürün olmasın"</em>
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i}
                    className="max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-snug"
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      ...(m.role === 'user'
                        ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }
                        : m.isError
                          ? { background: 'var(--err-bg)', color: 'var(--err-tx)', border: '1px solid var(--err-bd)' }
                          : { background: 'var(--surface2)', color: 'var(--tx1)', border: '1px solid var(--border)' }),
                    }}>
                    {m.text}
                  </div>
                ))}
                {aiLoading && (
                  <div className="px-3 py-2 rounded-2xl text-[13px] flex items-center gap-1.5"
                    style={{ alignSelf: 'flex-start', background: 'var(--surface2)', color: 'var(--tx3)' }}>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                    düşünüyor…
                  </div>
                )}
              </div>

              {/* Aktif kurallar */}
              {rules.length > 0 && (
                <div className="shrink-0 px-4 py-2.5 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex flex-wrap gap-1.5">
                    {rules.map((r, i) => (
                      <span key={i}
                        className="text-[11px] font-medium pl-2 pr-1 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)' }}>
                        {r.description}
                        <button onClick={() => handleRemoveRule(i)} disabled={aiLoading}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:opacity-70 shrink-0 text-[10px]"
                          style={{ background: 'rgba(0,0,0,0.08)' }}>
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={handleApplyToTsoft}
                    disabled={applyLoading}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {applyLoading ? 'Uygulanıyor…' : "Bu Sıralamayı T-Soft'a Uygula"}
                  </button>
                </div>
              )}

              {/* Giriş */}
              <div className="shrink-0 p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                <input
                  type="text"
                  placeholder="Talimat yazın…"
                  value={aiInstruction}
                  onChange={e => setAiInstruction(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAiInstruction(); }}
                  disabled={aiLoading}
                  className="flex-1 px-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                />
                <button
                  onClick={handleAiInstruction}
                  disabled={aiLoading || !aiInstruction.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all shrink-0"
                  style={aiLoading || !aiInstruction.trim()
                    ? { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)', cursor: 'not-allowed' }
                    : { background: 'linear-gradient(135deg, #10b981, #059669)' }
                  }>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
