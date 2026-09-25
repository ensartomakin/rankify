import { useEffect, useRef, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WeightDonut } from '../components/WeightDonut';
import { WeightBar } from '../components/WeightBar';
import { CriterionCard } from '../components/CriterionCard';
import { CategoryPicker } from '../components/CategoryPicker';
import {
  getCurrentRanking, previewRanking, applyManualRanking, aiAdjustRanking,
} from '../api/ranking';
import type {
  CurrentRankingResponse, CurrentRankItem,
  PreviewResponse, ProductPreviewItem, AdjustRule,
} from '../api/ranking';
import { saveConfig } from '../api/config';
import { fetchGa4Status } from '../api/ga4';
import { getStoredThreshold } from '../utils/threshold';
import { formatPercent } from '../utils/format';
import type { WeightCriterion, CriterionKey, SeasonPreFilter } from '../types';
import type { SavedConfig } from '../api/config';
import { SCENARIOS } from '../data/scenarios';
import type { Scenario } from '../data/scenarios';

const DEFAULT_CRITERIA: WeightCriterion[] = [
  { key: 'stockScore',  weight: 34, direction: 'desc' },
  { key: 'bestSeller',  weight: 33, direction: 'desc', salesPeriod: '14d' },
  { key: 'newness',     weight: 33, direction: 'desc' },
];

/* ─── Fotoğraf URL yardımcısı ─── */
function buildFallbackUrls(apiUrl: string, productId: string, productCode: string): string[] {
  const base = apiUrl.replace(/\/$/, '');
  const stripped = productCode.replace(/^[Tt]/, '');
  const ids = [...new Set([productId, stripped, productCode].filter(Boolean))];
  const paths = [
    (id: string) => `${base}/img/products/b/${id}_1.jpg`,
    (id: string) => `${base}/img/products/s/${id}_1.jpg`,
    (id: string) => `${base}/img/products/${id}_1.jpg`,
    (id: string) => `${base}/upload/urun/${id}_1.jpg`,
    (id: string) => `${base}/upload/urunler/${id}_1.jpg`,
    (id: string) => `${base}/UserFiles/Image/urun/${id}_1.jpg`,
  ];
  const urls: string[] = [];
  for (const id of ids) for (const fn of paths) urls.push(fn(id));
  return urls;
}

function getImageUrls(apiUrl: string, imageUrl: string, productId: string, productCode: string): string[] {
  const urls: string[] = [];
  if (imageUrl) {
    // Mutlak URL mu?
    if (imageUrl.startsWith('http')) urls.push(imageUrl);
    else urls.push(`${apiUrl.replace(/\/$/, '')}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`);
  }
  urls.push(...buildFallbackUrls(apiUrl, productId, productCode));
  return [...new Set(urls)];
}

const fmtPct = (n: number) => formatPercent(n, 2);
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Placeholder ikonu ─── */
function ImgPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: 'var(--surface2)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
        className="w-10 h-10" style={{ color: 'var(--border-strong)' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}

/* ─── Raptiye ikonu ─── */
function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill={pinned ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 014 4v4l2 3H6l2-3V6a4 4 0 014-4z" />
      <line x1="12" y1="13" x2="12" y2="21" />
      <line x1="9" y1="6" x2="15" y2="6" />
    </svg>
  );
}

/* ─── Kart: Mevcut sıralama (sürüklenebilir) ─── */
function CurrentCard({
  p, apiUrl, dragHandleProps, onRankEdit, isPinned, onTogglePin,
}: {
  p: CurrentRankItem;
  apiUrl: string;
  dragHandleProps?: Record<string, unknown> & { ref?: React.Ref<HTMLDivElement> };
  onRankEdit?: (newRank: number) => void;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const urls = getImageUrls(apiUrl, p.imageUrl, p.productId, p.productCode);
  const [imgIdx,    setImgIdx]    = useState(0);
  const [editing,   setEditing]   = useState(false);
  const [rankInput, setRankInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setRankInput(String(p.currentRank));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    const n = parseInt(rankInput, 10);
    if (!isNaN(n) && n >= 1) onRankEdit?.(n);
    setEditing(false);
  }

  return (
    <div className="rounded-[20px] overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isPinned ? '1.5px solid var(--acc-bd)' : '1px solid var(--border)',
        
      }}>

      {/* Drag handle */}
      <div className="flex items-center justify-center py-1.5 select-none"
        ref={dragHandleProps?.ref}
        style={{
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          cursor: isPinned ? 'not-allowed' : 'grab',
          touchAction: 'none',
          opacity: isPinned ? 0.4 : 1,
        }}
        {...(!isPinned ? (dragHandleProps as React.HTMLAttributes<HTMLDivElement>) : {})}>
        <svg viewBox="0 0 20 10" fill="currentColor" className="w-5 h-3" style={{ color: 'var(--tx3)' }}>
          <circle cx="4"  cy="2" r="1.5"/><circle cx="10" cy="2" r="1.5"/><circle cx="16" cy="2" r="1.5"/>
          <circle cx="4"  cy="8" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="16" cy="8" r="1.5"/>
        </svg>
      </div>

      {/* Fotoğraf */}
      <div className="relative overflow-hidden" style={{ height: 180, background: 'var(--surface2)' }}>
        {imgIdx < urls.length
          ? <img key={urls[imgIdx]} src={urls[imgIdx]} alt={p.productName}
              onError={() => setImgIdx(i => i + 1)}
              className="w-full h-full object-contain" />
          : <ImgPlaceholder />
        }
        {/* Sıra rozeti */}
        <div className="absolute top-2 left-2">
          {editing ? (
            <input ref={inputRef} type="number" min={1} value={rankInput}
              onChange={e => setRankInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="w-14 text-center text-label font-bold rounded-full px-2 py-1 outline-none"
              style={{ background: 'var(--acc)', color: 'var(--cta-tx)', border: '2px solid var(--acc)' }}
              onClick={e => e.stopPropagation()} />
          ) : (
            <button onClick={startEdit}
              className="text-label font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', backdropFilter: 'blur(4px)', border: '1px solid var(--acc-bd)', cursor: 'pointer' }}
              title="Sıra numarasını düzenle">
              #{p.currentRank}
            </button>
          )}
        </div>
        {/* Raptiye butonu */}
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(); }}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full transition-all"
          style={isPinned
            ? { background: 'var(--acc)', color: 'var(--cta-tx)' }
            : { background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }
          }
          title={isPinned ? 'Sabitlemeyi kaldır' : 'Bu konuma sabitle'}>
          <PinIcon pinned={isPinned} />
        </button>
      </div>

      {/* Ad */}
      <div className="px-3 pt-2 pb-1 flex-1">
        {isPinned && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-label font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
              📌 Sabitlendi
            </span>
          </div>
        )}
        <a href={p.seoUrl
            ? (p.seoUrl.startsWith('http') ? p.seoUrl : `${apiUrl.replace(/\/$/, '')}/urun-detay/${p.seoUrl.replace(/^\//, '')}`)
            : `${apiUrl.replace(/\/$/, '')}/urun-detay/${p.productCode}`}
          target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold leading-snug line-clamp-2 hover:underline"
          style={{ color: 'var(--tx1)' }}>
          {p.productName || p.productCode}
        </a>
      </div>

      {/* Alt bilgi */}
      <div className="px-3 py-2 flex items-center justify-between gap-2"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-label font-mono truncate min-w-0" style={{ color: 'var(--tx3)' }}>#{p.productCode}</span>
        <span className="text-label shrink-0" style={{ color: 'var(--tx3)' }}>Stok: {p.totalStock.toLocaleString('tr-TR')}</span>
      </div>
    </div>
  );
}

/* ─── Sortable wrapper ─── */
function SortableCurrentCard({ p, apiUrl, onRankEdit, isPinned, onTogglePin }: {
  p: CurrentRankItem; apiUrl: string; onRankEdit: (code: string, newRank: number) => void;
  isPinned: boolean; onTogglePin: (code: string, rank: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.productCode, disabled: isPinned });
  return (
    <div ref={setNodeRef} {...attributes} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 50 : undefined }}>
      <CurrentCard p={p} apiUrl={apiUrl}
        isPinned={isPinned}
        onTogglePin={() => onTogglePin(p.productCode, p.currentRank)}
        dragHandleProps={{ ref: setActivatorNodeRef, ...listeners }}
        onRankEdit={newRank => onRankEdit(p.productCode, newRank)} />
    </div>
  );
}

/* ─── Kart: Önizleme sıralaması ─── */
function PreviewCard({ p, displayRank, criteria, apiUrl, dragHandleProps, onRankEdit, isPinned, onTogglePin }: {
  p: ProductPreviewItem;
  displayRank: number;
  criteria: PreviewResponse['criteria'];
  apiUrl: string;
  dragHandleProps?: Record<string, unknown> & { ref?: React.Ref<HTMLDivElement> };
  onRankEdit?: (newRank: number) => void;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const urls = getImageUrls(apiUrl, p.imageUrl, p.productId, p.productCode);
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [rankInput, setRankInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setRankInput(String(displayRank));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }
  function commitEdit() {
    const n = parseInt(rankInput, 10);
    if (!isNaN(n) && n >= 1) onRankEdit?.(n);
    setEditing(false);
  }

  return (
    <div className="rounded-[20px] overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isPinned ? '1.5px solid var(--acc-bd)' : p.isDisqualified ? '1.5px solid var(--err-bd)' : '1px solid var(--border)',
        
      }}>

      {/* Drag handle */}
      <div className="flex items-center justify-center py-1.5 select-none"
        ref={dragHandleProps?.ref}
        style={{
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          cursor: isPinned ? 'not-allowed' : 'grab',
          touchAction: 'none',
          opacity: isPinned ? 0.4 : 1,
        }}
        {...(!isPinned ? (dragHandleProps as React.HTMLAttributes<HTMLDivElement>) : {})}>
        <svg viewBox="0 0 20 10" fill="currentColor" className="w-5 h-3" style={{ color: 'var(--tx3)' }}>
          <circle cx="4"  cy="2" r="1.5"/><circle cx="10" cy="2" r="1.5"/><circle cx="16" cy="2" r="1.5"/>
          <circle cx="4"  cy="8" r="1.5"/><circle cx="10" cy="8" r="1.5"/><circle cx="16" cy="8" r="1.5"/>
        </svg>
      </div>

      {/* Fotoğraf */}
      <div className="relative overflow-hidden" style={{ height: 180, background: 'var(--surface2)' }}>
        {idx < urls.length
          ? <img key={urls[idx]} src={urls[idx]} alt={p.productName}
              onError={() => setIdx(i => i + 1)}
              className="w-full h-full object-contain" />
          : <ImgPlaceholder />
        }
        {/* Sıra rozeti — dışlanan ürünlerde de düzenlenebilir */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {editing ? (
            <input ref={inputRef} type="number" min={1} value={rankInput}
              onChange={e => setRankInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="w-14 text-center text-label font-bold rounded-full px-2 py-1 outline-none"
              style={{ background: 'var(--acc)', color: 'var(--cta-tx)', border: '2px solid var(--acc)' }}
              onClick={e => e.stopPropagation()} />
          ) : (
            <button onClick={startEdit}
              className="text-label font-bold px-2.5 py-1 rounded-full"
              style={{
                background: p.isDisqualified ? 'rgba(0,0,0,0.45)' : 'var(--acc-bg)',
                color: p.isDisqualified ? 'rgba(255,255,255,0.9)' : 'var(--acc-tx)',
                border: p.isDisqualified ? 'none' : '1px solid var(--acc-bd)',
                backdropFilter: 'blur(4px)', cursor: 'pointer',
              }}
              title="Sıra numarasını düzenle">
              #{displayRank}
            </button>
          )}
          {p.isDisqualified && (
            <span className="text-label font-bold px-2 py-0.5 rounded-full self-start"
              style={{ background: 'var(--err-bg)', color: 'var(--err-tx)', border: '1px solid var(--err-bd)' }}>
              Dışlandı
            </span>
          )}
        </div>
        {/* Raptiye butonu */}
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(); }}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full transition-all"
          style={isPinned
            ? { background: 'var(--acc)', color: 'var(--cta-tx)' }
            : { background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }
          }
          title={isPinned ? 'Sabitlemeyi kaldır' : 'Bu konuma sabitle'}>
          <PinIcon pinned={isPinned} />
        </button>
      </div>

      {/* Ad */}
      <div className="px-3 pt-2.5 pb-1.5 flex-1">
        {isPinned && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-label font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
              📌 Sabitlendi
            </span>
          </div>
        )}
        <a href={p.seoUrl
            ? (p.seoUrl.startsWith('http') ? p.seoUrl : `${apiUrl.replace(/\/$/, '')}/${p.seoUrl.replace(/^\//, '')}`)
            : `${apiUrl.replace(/\/$/, '')}/urun-detay/${p.productCode}`}
          target="_blank" rel="noopener noreferrer"
          className="text-caption font-semibold leading-snug line-clamp-2 hover:underline"
          style={{ color: 'var(--tx1)' }}>
          {p.productName || p.productCode}
        </a>
      </div>

      {/* Puan dağılımı */}
      <div className="px-3 pb-1">
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {criteria.map(c => {
            const key = c.key as CriterionKey;
            const contrib = p.criteriaContributions[key] ?? 0;
            const GA4_LABELS: Partial<Record<CriterionKey, string>> = {
              ga4Views:          'GA4 Görüntülenme',
              ga4CartAdds:       'GA4 Sepete Ekleme',
              ga4ConversionRate: 'GA4 Dönüşüm',
            };
            const label =
              key === 'bestSeller'       ? `Satış (${formatPercent(c.weight)})` :
              key === 'stockScore'       ? `Stok (${formatPercent(c.weight)})` :
              key === 'newness'          ? `Yenilik (${formatPercent(c.weight)})` :
              key === 'reviewScore'      ? `Yorum (${formatPercent(c.weight)})` :
              key === 'availabilityScore'? `Bulunurluk (${formatPercent(c.weight)})` :
              key === 'discountRate'     ? `İndirim (${formatPercent(c.weight)})` :
              `${GA4_LABELS[key] ?? key} (${formatPercent(c.weight)})`;
            let raw: string | number = '';
            if (key === 'stockScore')             raw = p.totalStock.toLocaleString('tr-TR');
            else if (key === 'bestSeller')        raw = p.salesQty.toLocaleString('tr-TR');
            else if (key === 'newness')           raw = fmtDate(p.registrationDate);
            else if (key === 'reviewScore')       raw = p.reviewCount.toLocaleString('tr-TR');
            else if (key === 'availabilityScore') raw = fmtPct(p.availabilityRate * 100);
            else if (key === 'discountRate')      raw = `%${(p.discountRate ?? 0).toLocaleString('tr-TR')}`;
            else if (key === 'ga4Views')          raw = (p.ga4?.views ?? 0).toLocaleString('tr-TR');
            else if (key === 'ga4CartAdds')       raw = (p.ga4?.cartAdds ?? 0).toLocaleString('tr-TR');
            else if (key === 'ga4ConversionRate') raw = formatPercent(p.ga4?.conversionRate ?? 0, 2);
            return (
              <div key={key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-caption"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="min-w-0 flex items-baseline gap-1 overflow-hidden">
                  <span className="shrink-0" style={{ color: 'var(--tx2)' }}>{label}:</span>
                  <span className="truncate font-medium" style={{ color: 'var(--tx1)' }}>{raw}</span>
                </div>
                <span className="font-bold tabular-nums shrink-0" style={{ color: 'var(--acc-tx)' }}>
                  {fmtPct(contrib)}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-2.5 py-2"
            style={{ background: 'var(--acc-bg)' }}>
            <span className="text-caption font-bold" style={{ color: 'var(--tx1)' }}>Toplam</span>
            <span className="text-caption font-bold" style={{ color: 'var(--acc-tx)' }}>
              {fmtPct(p.rankingScore)}
            </span>
          </div>
        </div>
        {p.isDisqualified && p.disqualifyReason && (
          <p className="text-caption mt-1 px-0.5" style={{ color: 'var(--err-tx)' }}>⚠ {p.disqualifyReason}</p>
        )}
      </div>

      <div className="px-3 py-2 flex flex-col gap-1"
        style={{ borderTop: '1px solid var(--border)' }}>
        {p.season && (
          <span className="text-label font-semibold px-2 py-0.5 rounded-full self-start"
            style={{ background: 'var(--surface2)', color: 'var(--tx3)', border: '1px solid var(--border)' }}>
            🗓 {p.season}
          </span>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-mono truncate min-w-0" style={{ color: 'var(--tx3)' }}>#{p.productCode}</span>
          <span className="text-label shrink-0" style={{ color: 'var(--tx3)' }}>Stok: {p.totalStock.toLocaleString('tr-TR')}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Sortable wrapper: Önizleme ─── */
function SortablePreviewCard({ p, displayRank, criteria, apiUrl, onRankEdit, isPinned, onTogglePin }: {
  p: ProductPreviewItem; displayRank: number; criteria: PreviewResponse['criteria'];
  apiUrl: string; onRankEdit: (code: string, newRank: number) => void;
  isPinned: boolean; onTogglePin: (code: string, rank: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.productCode, disabled: isPinned });
  return (
    <div ref={setNodeRef} {...attributes} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1, zIndex: isDragging ? 50 : undefined }}>
      <PreviewCard p={p} displayRank={displayRank} criteria={criteria} apiUrl={apiUrl}
        isPinned={isPinned}
        onTogglePin={() => onTogglePin(p.productCode, displayRank)}
        dragHandleProps={{ ref: setActivatorNodeRef, ...listeners }}
        onRankEdit={newRank => onRankEdit(p.productCode, newRank)} />
    </div>
  );
}

interface ChatMessage {
  role:     'user' | 'assistant';
  text:     string;
  isError?: boolean;
}

// AI-adjust isteğine sadece sıralama için gereken alanları gönder — tüm skor/görsel
// verisini tekrar yollamak büyük kategorilerde istek boyutu limitini aşıyor.
function toAiAdjustProducts(products: ProductPreviewItem[]) {
  return products.map(p => ({
    productCode:    p.productCode,
    productName:    p.productName,
    categoryPath:   p.categoryPath,
    season:         p.season,
    isDisqualified: p.isDisqualified,
    finalRank:      p.finalRank,
  }));
}

// AI-adjust yanıtındaki (minimal) yeni sırayı, elimizdeki zengin ürün verisiyle birleştirir.
function mergeAiOrder(
  base: ProductPreviewItem[],
  order: { productCode: string; finalRank: number }[]
): ProductPreviewItem[] {
  const byCode = new Map(base.map(p => [p.productCode, p]));
  return order
    .map(o => {
      const full = byCode.get(o.productCode);
      return full ? { ...full, finalRank: o.finalRank } : null;
    })
    .filter((p): p is ProductPreviewItem => p !== null);
}

/* ─── Ana bileşen ─── */
type Status = 'idle' | 'loading' | 'success' | 'error';

const cardSt = { background: 'var(--panel)', boxShadow: 'var(--shadow-panel)' };
/* Every panel on this page: 16px radius, p-card padding, flat title. */
/* Footer buttons: one teal primary, the rest outline or ghost. */
const btnCls      = 'h-9 px-4 rounded-lg text-caption transition-all whitespace-nowrap';
const btnOutline  = { background: 'transparent', color: 'var(--tx1)', border: '1px solid var(--border-strong)', cursor: 'pointer' };
const btnDisabled = { background: 'transparent', color: 'var(--tx3)', border: '1px solid var(--border)', cursor: 'not-allowed' };
const panelCls = 'min-w-0 max-w-full rounded-2xl p-card flex flex-col gap-stack';

function PanelTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-tight">
      <h2 className="flex items-center gap-tight text-label font-bold uppercase tracking-wide" style={{ color: 'var(--tx2)' }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

interface Props { prefill?: SavedConfig; }

export function Dashboard({ prefill }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<{ id: string; name: string }[]>(
    prefill ? [{ id: prefill.categoryId, name: prefill.categoryName ?? '' }] : []
  );
  const categoryId   = selectedCategories[0]?.id   ?? '';
  const categoryName = selectedCategories[0]?.name ?? '';
  const [threshold,    setThreshold]    = useState(prefill ? prefill.availabilityThreshold : getStoredThreshold());
  const [criteria,     setCriteria]     = useState<WeightCriterion[]>(
    prefill?.criteria ?? DEFAULT_CRITERIA
  );
  const [smartMix,        setSmartMix]        = useState(true);
  const [seasonPreFilter, setSeasonPreFilter] = useState<SeasonPreFilter>('none');
  const [ga4Connected,    setGa4Connected]    = useState(false);
  const [scenarioOpen,    setScenarioOpen]    = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const scenarioRef = useRef<HTMLDivElement>(null);

  const [saveStatus,    setSaveStatus]    = useState<Status>('idle');
  const [triggerStatus, setTriggerStatus] = useState<Status>('idle');
  const [message,       setMessage]       = useState('');
  const isConfigError = triggerStatus === 'error' || saveStatus === 'error';

  // Mevcut sıralama
  const [currentResult, setCurrentResult] = useState<CurrentRankingResponse | null>(null);
  const [currentStatus, setCurrentStatus] = useState<Status>('idle');
  const [currentError,  setCurrentError]  = useState('');

  // Manuel sıralama — mevcut görünüm
  const [manualOrder,  setManualOrder]  = useState<CurrentRankItem[]>([]);
  const [manualDirty,  setManualDirty]  = useState(false);
  const [manualStatus, setManualStatus] = useState<Status>('idle');

  // Önizleme
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [previewStatus, setPreviewStatus] = useState<Status>('idle');
  const [previewError,  setPreviewError]  = useState('');

  // Manuel sıralama — önizleme görünümü
  const [previewOrder, setPreviewOrder] = useState<ProductPreviewItem[]>([]);

  // Sabitleme
  const [pinnedPositions, setPinnedPositions] = useState<Record<string, number>>({});

  // AI destekli sıralama düzenleme (yüzen sohbet paneli)
  const [aiRules,      setAiRules]      = useState<AdjustRule[]>([]);
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [chatOpen,     setChatOpen]     = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiLoading,    setAiLoading]    = useState(false);

  // Filtre & görünüm
  const [filter, setFilter] = useState('');
  const [showDq,  setShowDq]  = useState(true);
  const [view,    setView]    = useState<'current' | 'preview'>('current');

  const total   = criteria.reduce((s, c) => s + c.weight, 0);
  const isValid = total === 100 && categoryId.trim().length > 0;
  const isBusy  = currentStatus === 'loading' || previewStatus === 'loading' || saveStatus === 'loading' || triggerStatus === 'loading';

  // DnD sensörleri
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // GA4 bağlantı durumunu yükle
  useEffect(() => {
    fetchGa4Status().then(s => setGa4Connected(s.ready)).catch(() => {});
  }, []);

  // Senaryo dropdown dışına tıklanınca kapat
  useEffect(() => {
    if (!scenarioOpen) return;
    function handleClick(e: MouseEvent) {
      if (scenarioRef.current && !scenarioRef.current.contains(e.target as Node)) {
        setScenarioOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [scenarioOpen]);

  // Kategori değişince mevcut sıralamayı yükle
  useEffect(() => {
    setPreviewResult(null);
    setPreviewStatus('idle');
    setPreviewError('');
    setView('current');
    setManualDirty(false);
    setAiRules([]);
    setMessages([]);
    if (!categoryId) { setCurrentResult(null); setCurrentStatus('idle'); setManualOrder([]); setPinnedPositions({}); return; }

    const stored = localStorage.getItem(`rankify_pin_${categoryId}`);
    setPinnedPositions(stored ? JSON.parse(stored) : {});

    let cancelled = false;
    setCurrentStatus('loading');
    setCurrentError('');
    setCurrentResult(null);
    setManualOrder([]);
    getCurrentRanking(categoryId)
      .then(r => {
        if (!cancelled) {
          setCurrentResult(r);
          setManualOrder(r.products);
          setCurrentStatus('idle');
        }
      })
      .catch(e => { if (!cancelled) { setCurrentError(e instanceof Error ? e.message : 'Yükleme hatası'); setCurrentStatus('error'); } });
    return () => { cancelled = true; };
  }, [categoryId]);

  // Kriter/eşik/sezon değişince önizlemeyi sıfırla
  useEffect(() => {
    setPreviewResult(null);
    setPreviewStatus('idle');
    setPreviewError('');
    setAiRules([]);
    setMessages([]);
    if (view === 'preview') setView('current');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, JSON.stringify(criteria), smartMix, seasonPreFilter]);

  function togglePin(code: string, rank: number) {
    setPinnedPositions(prev => {
      const next = { ...prev };
      if (next[code] !== undefined) delete next[code];
      else next[code] = rank;
      localStorage.setItem(`rankify_pin_${categoryId}`, JSON.stringify(next));
      return next;
    });
  }

  function clearAllPins() {
    setPinnedPositions({});
    localStorage.removeItem(`rankify_pin_${categoryId}`);
  }

  function applyPinnedPositions(items: ProductPreviewItem[], pins = pinnedPositions): ProductPreviewItem[] {
    const pinCodes = Object.keys(pins);
    if (pinCodes.length === 0) return items;
    const pinnedInResult  = items.filter(p => pins[p.productCode] !== undefined);
    const unpinned        = items.filter(p => pins[p.productCode] === undefined);
    if (pinnedInResult.length === 0) return items;
    const sortedPinned = [...pinnedInResult].sort((a, b) => pins[a.productCode] - pins[b.productCode]);
    const result: ProductPreviewItem[] = [...unpinned];
    for (const p of sortedPinned) {
      const idx = Math.max(0, Math.min(result.length, pins[p.productCode] - 1));
      result.splice(idx, 0, p);
    }
    return result.map((p, i) => ({ ...p, finalRank: i + 1 }));
  }

  function applyPinnedPositionsCurrent(items: CurrentRankItem[], pins = pinnedPositions): CurrentRankItem[] {
    const pinCodes = Object.keys(pins);
    if (pinCodes.length === 0) return items;
    const pinnedInResult = items.filter(p => pins[p.productCode] !== undefined);
    const unpinned       = items.filter(p => pins[p.productCode] === undefined);
    if (pinnedInResult.length === 0) return items;
    const sortedPinned = [...pinnedInResult].sort((a, b) => pins[a.productCode] - pins[b.productCode]);
    const result: CurrentRankItem[] = [...unpinned];
    for (const p of sortedPinned) {
      const idx = Math.max(0, Math.min(result.length, pins[p.productCode] - 1));
      result.splice(idx, 0, p);
    }
    return result.map((p, i) => ({ ...p, currentRank: i + 1 }));
  }

  function handleCriterionChange(i: number, updated: WeightCriterion) {
    setCriteria(prev => { const n = [...prev]; n[i] = updated; return n; });
  }

  function addCriterion() {
    setCriteria(prev => {
      if (prev.length >= 5) return prev;
      const newWeight = Math.floor(100 / (prev.length + 1));
      const remainder = 100 - newWeight * (prev.length + 1);
      const scaled = prev.map((c, i) => ({
        ...c,
        weight: newWeight + (i === 0 ? remainder : 0),
      }));
      const usedKeys = prev.map(c => c.key);
      const allKeys: CriterionKey[] = ['stockScore', 'bestSeller', 'newness', 'reviewScore', 'discountRate', 'ga4Views', 'ga4CartAdds', 'ga4ConversionRate', 'availabilityScore'];
      const nextKey = allKeys.find(k => !usedKeys.includes(k)) ?? 'reviewScore';
      return [...scaled, { key: nextKey, weight: newWeight, direction: 'desc' as const }];
    });
  }

  function removeCriterion(idx: number) {
    setCriteria(prev => {
      if (prev.length <= 3) return prev;
      const next = prev.filter((_, i) => i !== idx);
      const otherSum = next.reduce((s, c) => s + c.weight, 0);
      if (otherSum === 0) {
        const w = Math.floor(100 / next.length);
        return next.map((c, i) => ({ ...c, weight: w + (i === 0 ? 100 - w * next.length : 0) }));
      }
      let allocated = 0;
      return next.map((c, i) => {
        if (i < next.length - 1) {
          const w = Math.round((c.weight / otherSum) * 100);
          allocated += w;
          return { ...c, weight: w };
        }
        return { ...c, weight: 100 - allocated };
      });
    });
  }

  // DnD drag end
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const pins = pinnedPositions;
    setManualOrder(items => {
      const oldIdx = items.findIndex(p => p.productCode === active.id);
      const newIdx = items.findIndex(p => p.productCode === over.id);
      let newOrder = arrayMove(items, oldIdx, newIdx).map((p, i) => ({ ...p, currentRank: i + 1 }));
      if (Object.keys(pins).length > 0) newOrder = applyPinnedPositionsCurrent(newOrder, pins);
      return newOrder;
    });
    setManualDirty(true);
  }

  // Rank numarası manuel değişince
  function handleRankEdit(code: string, newRank: number) {
    const clamped = Math.max(1, Math.min(manualOrder.length, newRank));
    if (pinnedPositions[code] !== undefined) {
      const newPins = { ...pinnedPositions, [code]: clamped };
      setPinnedPositions(newPins);
      localStorage.setItem(`rankify_pin_${categoryId}`, JSON.stringify(newPins));
      setManualOrder(applyPinnedPositionsCurrent(manualOrder, newPins));
      setManualDirty(true);
      return;
    }
    setManualOrder(items => {
      const idx = items.findIndex(p => p.productCode === code);
      if (idx === -1) return items;
      const next = [...items];
      const [item] = next.splice(idx, 1);
      next.splice(clamped - 1, 0, item);
      let newOrder = next.map((p, i) => ({ ...p, currentRank: i + 1 }));
      if (Object.keys(pinnedPositions).length > 0) newOrder = applyPinnedPositionsCurrent(newOrder, pinnedPositions);
      return newOrder;
    });
    setManualDirty(true);
  }

  async function handleApplyManual() {
    if (!categoryId || manualOrder.length === 0) return;
    setManualStatus('loading'); setMessage('');
    try {
      await applyManualRanking(categoryId, manualOrder.map(p => ({ productCode: p.productCode, rank: p.currentRank })));
      setManualStatus('idle');
      setManualDirty(false);
      setMessage('Manuel sıralama T-Soft\'a uygulandı.');
    } catch (err) {
      setManualStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Hata');
    }
  }

  function handleToggleCategory(id: string, name: string) {
    setSelectedCategories(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return [...prev, { id, name }];
      if (prev.length === 1) return [];
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function handleSave() {
    if (!isValid) return;
    setSaveStatus('loading'); setMessage('');
    let done = 0; let fail = 0;
    for (const { id, name } of selectedCategories) {
      try {
        await saveConfig({ categoryId: id, categoryName: name.trim() || undefined, availabilityThreshold: threshold, criteria });
        done++;
      } catch { fail++; }
    }
    if (fail === 0) {
      setSaveStatus('success');
      setMessage(selectedCategories.length > 1 ? `${done} kategori kaydedildi.` : 'Konfigürasyon kaydedildi.');
    } else {
      setSaveStatus('error');
      setMessage(`${done} başarılı, ${fail} başarısız.`);
    }
  }

  function handleExportCsv() {
    const rows: [string, string, string, string][] = [];
    const categoryWsCode = `T${categoryId}`;
    if (view === 'preview' && previewOrder.length > 0) {
      previewOrder.forEach(p => {
        rows.push([p.productCode, p.productName || '', categoryWsCode, String(p.finalRank)]);
      });
    } else if (manualOrder.length > 0) {
      manualOrder.forEach(p => {
        rows.push([p.productCode, p.productName || '', categoryWsCode, String(p.currentRank)]);
      });
    }
    if (rows.length === 0) return;

    const header = ['Ürün Web Servis Kodu', 'Ürün Adı', 'Kategori Web Servis Kodu', 'Kategori Sıra No'];
    const csvContent = [header, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siralama_${categoryId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePreview() {
    if (!isValid) return;
    setPreviewStatus('loading'); setPreviewError(''); setPreviewResult(null);
    try {
      const result = await previewRanking({ categoryId: categoryId.trim(), availabilityThreshold: threshold, criteria, smartMix, seasonPreFilter });
      setPreviewResult(result);
      let products = result.products;
      // Aktif AI kuralları varsa, yeni önizleme verisine yeniden uygula
      if (aiRules.length > 0) {
        try {
          const resp = await aiAdjustRanking({ categoryId: categoryId.trim(), products: toAiAdjustProducts(result.products), rules: aiRules, smartMix, seasonPreFilter });
          setAiRules(resp.rules);
          products = mergeAiOrder(result.products, resp.products);
        } catch {
          setAiRules([]);
        }
      }
      setPreviewOrder(applyPinnedPositions(products));
      setPreviewStatus('idle');
      setView('preview');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Önizleme hatası');
      setPreviewStatus('error');
    }
  }

  async function handleAiInstruction() {
    const instruction = aiInstruction.trim();
    if (!instruction || !previewResult || !categoryId || aiLoading) return;
    setAiLoading(true);
    setMessages(m => [...m, { role: 'user', text: instruction }]);
    setAiInstruction('');
    try {
      const resp = await aiAdjustRanking({ categoryId: categoryId.trim(), products: toAiAdjustProducts(previewResult.products), rules: aiRules, instruction, smartMix, seasonPreFilter });
      setAiRules(resp.rules);
      setPreviewOrder(applyPinnedPositions(mergeAiOrder(previewResult.products, resp.products)));
      setView('preview');
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

  async function handleRemoveAiRule(idx: number) {
    if (!previewResult || !categoryId || aiLoading) return;
    const newRules = aiRules.filter((_, i) => i !== idx);
    if (newRules.length === 0) {
      setAiRules([]);
      setPreviewOrder(applyPinnedPositions(previewResult.products));
      return;
    }
    setAiLoading(true);
    try {
      const resp = await aiAdjustRanking({ categoryId: categoryId.trim(), products: toAiAdjustProducts(previewResult.products), rules: newRules, smartMix, seasonPreFilter });
      setAiRules(resp.rules);
      setPreviewOrder(applyPinnedPositions(mergeAiOrder(previewResult.products, resp.products)));
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Kural kaldırılamadı';
      setMessages(m => [...m, { role: 'assistant', text, isError: true }]);
    } finally {
      setAiLoading(false);
    }
  }

  // Preview drag end
  function handlePreviewDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = previewOrder.findIndex(p => p.productCode === active.id);
    const newIdx = previewOrder.findIndex(p => p.productCode === over.id);
    let newOrder = arrayMove(previewOrder, oldIdx, newIdx).map((p, i) => ({ ...p, finalRank: i + 1 }));
    if (Object.keys(pinnedPositions).length > 0) newOrder = applyPinnedPositions(newOrder);
    setPreviewOrder(newOrder);
  }

  // Preview rank input
  function handlePreviewRankEdit(code: string, newRank: number) {
    const clamped = Math.max(1, Math.min(previewOrder.length, newRank));
    if (pinnedPositions[code] !== undefined) {
      // Pinlenmiş ürünün konumu değişiyor — pin pozisyonunu güncelle
      const newPins = { ...pinnedPositions, [code]: clamped };
      setPinnedPositions(newPins);
      localStorage.setItem(`rankify_pin_${categoryId}`, JSON.stringify(newPins));
      setPreviewOrder(applyPinnedPositions(previewOrder, newPins));
      return;
    }
    const idx = previewOrder.findIndex(p => p.productCode === code);
    if (idx === -1) return;
    const next = [...previewOrder];
    const [item] = next.splice(idx, 1);
    next.splice(clamped - 1, 0, item);
    let newOrder = next.map((p, i) => ({ ...p, finalRank: i + 1 }));
    if (Object.keys(pinnedPositions).length > 0) newOrder = applyPinnedPositions(newOrder);
    setPreviewOrder(newOrder);
  }

  async function handleTrigger() {
    if (!isValid || previewOrder.length === 0) return;
    setTriggerStatus('loading'); setMessage('');
    try {
      // Sadece aktif ürünleri gönder — T-Soft dışlananları zaten sona alır
      const activeProducts = previewOrder.filter(p => !p.isDisqualified);
      await applyManualRanking(
        categoryId.trim(),
        activeProducts.map((p, i) => ({ productCode: p.productCode, rank: i + 1 }))
      );
      // Ek kategoriler için algoritmayı çalıştır ve uygula
      for (const { id } of selectedCategories.slice(1)) {
        const result = await previewRanking({ categoryId: id, availabilityThreshold: threshold, criteria, smartMix });
        const active = result.products.filter(p => !p.isDisqualified);
        await applyManualRanking(id, active.map((p, i) => ({ productCode: p.productCode, rank: i + 1 })));
      }
      setTriggerStatus('success');
      setMessage(selectedCategories.length > 1
        ? `${selectedCategories.length} kategoriye sıralama uygulandı.`
        : 'Sıralama başarıyla uygulandı.'
      );
    } catch (err) {
      setTriggerStatus('error'); setMessage(err instanceof Error ? err.message : 'Hata');
    }
  }

  /* Buton durumu */
  const canManual  = view === 'current' && manualDirty && manualOrder.length > 0;
  const canPreview = view === 'preview' && previewOrder.length > 0;
  const canApply   = canManual || canPreview;
  const isApplying = manualStatus === 'loading' || triggerStatus === 'loading';
  const applyLabel = isApplying ? null : (canManual ? '⇅ Sıralamayı Uygula' : '✓ Sıralamayı Uygula');
  const applyTooltip = !canApply
    ? (view === 'current' ? 'Sıralamayı değiştirin veya Önizle\'ye basın' : 'Önce Önizle\'ye basın')
    : undefined;

  /* Filtreli liste */
  const apiUrl = previewResult?.apiUrl ?? currentResult?.apiUrl ?? '';

  const filteredCurrent = manualOrder.filter(p =>
    !filter.trim() ||
    p.productName.toLowerCase().includes(filter.toLowerCase()) ||
    p.productCode.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredPreview = previewOrder
    .filter(p => showDq || !p.isDisqualified)
    .filter(p =>
      !filter.trim() ||
      p.productName.toLowerCase().includes(filter.toLowerCase()) ||
      p.productCode.toLowerCase().includes(filter.toLowerCase())
    );

  const hasProducts = currentResult !== null || previewResult !== null;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--page-bg)' }}>
      {/* Başlık */}
      <div className="shrink-0 py-3 flex items-center justify-between gap-4 px-4 md:px-6"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-serif" style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 700, color: 'var(--tx1)', lineHeight: 1.2 }}>
          Sıralama Yöneticisi
        </h1>
      </div>

      {/* Kaydırılabilir içerik */}
      <div className="flex-1 overflow-y-auto space-y-section px-4 md:px-6 py-section">

        {/* Hero kategori arama alanı */}
        <div>
          {/* wrapper: border+shadow ama overflow:visible — dropdown taşabilsin */}
          <div className="relative" style={{
            borderRadius: '12px',
            border: categoryId ? '1.5px solid var(--acc)' : '1.5px solid var(--border-strong)',
            background: 'var(--surface)',
            transition: 'border-color 0.2s',
          }}>
            {/* Search icon */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4" aria-hidden="true"
                style={{ color: categoryId ? 'var(--acc)' : 'var(--tx3)' }}>
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-4.35-4.35" />
              </svg>
            </div>

            <CategoryPicker
              value={categoryId} label={categoryName}
              onChange={handleToggleCategory}
              heroMode
              multiSelect
              selectedIds={selectedCategories.map(c => c.id)}
              onToggle={handleToggleCategory}
            />

            {/* Kategori sayı pill */}
            {selectedCategories.length > 0 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none
                              flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(28,202,199,0.08)', border: '1px solid rgba(28,202,199,0.22)' }}>
                <span className="text-label font-mono font-semibold" style={{ color: 'var(--acc-tx)' }}>
                  {selectedCategories.length > 1 ? `${selectedCategories.length} kategori` : `#${categoryId}`}
                </span>
              </div>
            )}
          </div>


          {/* Seçili kategori chip'leri */}
          {selectedCategories.length > 1 && (
            <div className="flex flex-wrap gap-tight mt-tight">
              {selectedCategories.map(({ id, name }, idx) => (
                <button key={id} type="button"
                  onClick={() => handleToggleCategory(id, name)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-label font-semibold transition-all"
                  style={idx === 0
                    ? { background: 'rgba(28,202,199,0.12)', border: '1px solid rgba(28,202,199,0.3)', color: 'var(--acc-tx)' }
                    : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
                  {idx === 0 && <span style={{ fontSize: 'var(--text-label)' }}>★</span>}
                  <span>{name || id}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 opacity-60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Strateji Şablonları — ayrı kart */}
        <div ref={scenarioRef} className={panelCls} style={cardSt}>
          <PanelTitle action={selectedScenario && (
            <button onClick={() => setSelectedScenario(null)}
              className="text-label font-medium px-2 py-0.5 rounded-md"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--tx2)', cursor: 'pointer' }}>
              Temizle
            </button>
          )}>
            Hazır Strateji Şablonları
          </PanelTitle>

          {/* Senaryo ızgarası */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-tight">
            {SCENARIOS.map(s => {
              const isSelected = selectedScenario?.id === s.id;
              return (
                <button key={s.id}
                  onClick={() => { setCriteria(s.criteria); setSelectedScenario(isSelected ? null : s); }}
                  aria-pressed={isSelected}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    border: 'none',
                    background: isSelected ? 'var(--acc-bg)' : 'var(--surface2)',
                    boxShadow: isSelected ? 'inset 0 0 0 1.5px var(--acc)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface3)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}>
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{s.emoji}</span>
                  <div className="text-label font-bold leading-tight mt-0.5 break-words max-w-full" style={{ color: isSelected ? 'var(--acc-tx)' : 'var(--tx1)' }}>{s.name}</div>
                  <div className="text-caption leading-tight" style={{ color: 'var(--tx3)' }}>{s.tagline}</div>
                </button>
              );
            })}
          </div>

          {/* Seçili senaryo açıklaması */}
          {selectedScenario && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-stack)', padding: 'var(--spacing-stack)', borderRadius: '12px', background: 'var(--acc-bg)' }}>
              <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{selectedScenario.emoji}</span>
              <div>
                <div style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--acc-tx)' }}>
                  {selectedScenario.name}
                  <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--tx3)' }}>· {selectedScenario.tagline}</span>
                </div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--tx2)', marginTop: '4px', lineHeight: 1.6 }}>
                  {selectedScenario.description}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ağırlık + Beden (sol) | Sıralama Kriterleri (sağ) — from lg up the two
            columns stretch to the same height; the left column is a flex column
            and the Beden card absorbs the leftover space, so both columns end
            level even as criteria are added. minmax(0,1fr) prevents overflow. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-section">

          <div className="min-w-0 flex flex-col gap-section">
            {/* Ağırlık dağılımı */}
            <div className={`${panelCls} shrink-0`} style={cardSt}>
              <PanelTitle>Ağırlık Dağılımı</PanelTitle>
              <WeightDonut criteria={criteria} />
              <div className="pt-stack" style={{ borderTop: '1px solid var(--border)' }}>
                <WeightBar criteria={criteria} onChange={setCriteria} />
              </div>
            </div>

            {/* Beden Bulunurluk Eşiği */}
            <div className={`${panelCls} flex-1`} style={cardSt}>
              <PanelTitle>Beden Bulunurluk Eşiği</PanelTitle>
              <div className="flex-1 flex flex-col justify-center gap-stack">
                <div className="flex items-center justify-between gap-stack">
                  <p className="text-caption truncate min-w-0" style={{ color: 'var(--tx2)' }}
                    title="Bu eşiğin altındaki beden oranına sahip çok bedenli ürünler sıralamadan dışlanır">
                    Bu oranın altındaki çok bedenli ürünler dışlanır
                  </p>
                  <span className="text-body font-bold tabular-nums px-2.5 py-1 rounded-lg shrink-0"
                    style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
                    {formatPercent(Math.round(threshold * 100))}
                  </span>
                </div>
                <div>
                  <input type="range" min={0} max={1} step={0.05} value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    aria-label="Beden bulunurluk eşiği"
                    className="range-fill"
                    style={{ '--fill': `${threshold * 100}%` } as React.CSSProperties} />
                  <div className="flex justify-between text-label mt-tight" style={{ color: 'var(--tx3)' }}>
                    <span>{formatPercent(0)} — Tümü dahil</span>
                    <span>{formatPercent(50)}</span>
                    <span>{formatPercent(100)} — Tam stok</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sıralama Kriterleri */}
          <div className={panelCls} style={cardSt}>
            <PanelTitle>Sıralama Kriterleri</PanelTitle>
            <div>
              <div className="flex flex-col gap-stack">
                {criteria.map((c, i) => (
                  <CriterionCard key={i} index={i} criterion={c}
                    usedKeys={criteria.map(x => x.key)}
                    onChange={u => handleCriterionChange(i, u)}
                    onRemove={criteria.length > 3 ? () => removeCriterion(i) : undefined}
                    ga4Connected={ga4Connected} />
                ))}
                {criteria.length < 5 && (
                  <button onClick={addCriterion}
                    className="flex flex-row items-center justify-center gap-2 transition-all"
                    style={{
                      borderRadius: 'var(--radius-crit)',
                      minHeight: '64px', border: '2px dashed var(--border)',
                      background: 'transparent', cursor: 'pointer', color: 'var(--tx3)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc-bd)'; (e.currentTarget as HTMLElement).style.color = 'var(--acc-tx)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600 }}>Kriter Ekle</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Mix | Sezon Ön-Sıralaması — side by side from lg, equal height */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-section">
          {/* Smart Mix toggle */}
          <div className={panelCls} style={cardSt}>
            <PanelTitle>Smart Mix</PanelTitle>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-section)' }}>
              <p className="text-sm" style={{ color: 'var(--tx2)', maxWidth: '520px' }}>
                Aynı ürünün farklı renklerini ürün adına göre tespit eder, yan yana gelmelerini engeller
              </p>
              <button onClick={() => setSmartMix(v => !v)}
                className="relative shrink-0"
                style={{ width: 48, height: 26, borderRadius: 13, background: smartMix ? 'var(--acc)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                <span style={{
                  position: 'absolute', top: 4, left: smartMix ? 26 : 4,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>

          {/* Sezon Filtresi */}
          <div className={panelCls} style={cardSt}>
            <PanelTitle>
              Sezon Ön-Sıralaması
              <span className="relative group inline-flex normal-case tracking-normal font-normal">
                <button type="button" aria-label="Sezon ön-sıralaması hakkında"
                  aria-describedby="season-info"
                  className="w-4 h-4 inline-flex items-center justify-center rounded-full"
                  style={{ color: 'var(--tx3)', background: 'transparent', border: 'none', cursor: 'help' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
                  </svg>
                </button>
                <span id="season-info" role="tooltip"
                  className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-6 z-20 w-64 p-3 rounded-lg text-caption"
                  style={{ background: 'var(--tx1)', color: 'var(--bg)', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}>
                  Ürünler sıralama öncesinde sezon etiketine (Ek Bilgi 7) göre gruplanır. Seçilen sezonun ürünleri kendi sıralarını (puan, stok, bulunurluk) koruyarak öne alınır, ardından diğer sezon gelir. Dışlanan ürünler bundan etkilenmez.
                </span>
              </span>
              {seasonPreFilter !== 'none' && (
                <span className="text-label font-semibold normal-case tracking-normal px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
                  Aktif
                </span>
              )}
            </PanelTitle>
            <p className="text-caption truncate" style={{ color: 'var(--tx2)' }}>
              Seçilen sezonun ürünleri sıralamada öne alınır
            </p>
            <div role="radiogroup" aria-label="Sezon ön-sıralaması"
              className="flex p-1 gap-1 rounded-lg"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              {([
                { value: 'none'          as SeasonPreFilter, label: 'Tümü',            desc: 'Sezon filtresi yok' },
                { value: 'yaz-ilkbahar' as SeasonPreFilter, label: 'Yaz · İlkbahar', desc: 'Yaz/İlkbahar ürünleri önce (kendi sıralamasıyla), ardından Kış/Sonbahar' },
                { value: 'kis-sonbahar' as SeasonPreFilter, label: 'Kış · Sonbahar', desc: 'Kış/Sonbahar ürünleri önce (kendi sıralamasıyla), ardından Yaz/İlkbahar' },
              ] as { value: SeasonPreFilter; label: string; desc: string }[]).map(opt => {
                const isActive = seasonPreFilter === opt.value;
                return (
                  <button key={opt.value} type="button" role="radio" aria-checked={isActive}
                    onClick={() => setSeasonPreFilter(opt.value)}
                    title={opt.desc}
                    className="flex-1 min-w-0 h-8 px-2 rounded-md text-caption font-semibold truncate transition-all"
                    style={{
                      background: isActive ? 'var(--surface)' : 'transparent',
                      color: isActive ? 'var(--acc-tx)' : 'var(--tx2)',
                      border: isActive ? '1px solid var(--acc-bd)' : '1px solid transparent',
                      boxShadow: isActive ? '0 1px 2px rgba(21,16,53,0.08)' : 'none',
                      cursor: 'pointer',
                    }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mesajlar */}
        {previewError && previewStatus === 'error' && (
          <div className="px-5 py-3.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            ✕ Önizleme hatası: {previewError}
          </div>
        )}
        {currentError && currentStatus === 'error' && (
          <div className="px-5 py-3.5 rounded-lg text-sm font-medium"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            ✕ Yükleme hatası: {currentError}
          </div>
        )}
        {message && (
          <div className="px-5 py-3.5 rounded-lg text-sm font-medium flex items-center gap-3"
            style={isConfigError
              ? { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
              : { background: 'var(--ok-bg)',  border: '1px solid var(--ok-bd)',  color: 'var(--ok-tx)'  }
            }>
            {isConfigError ? '✕' : '✓'} {message}
          </div>
        )}

        {/* Ürün listesi alanı */}
        {categoryId && (
          <div style={{ ...cardSt, borderRadius: '16px' }}>

            {/* Liste başlığı / araç çubuğu */}
            <div style={{ padding: 'var(--spacing-stack) var(--spacing-card)', background: 'var(--panel)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
              {/* Üst satır: sekmeler + arama */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Sol: görünüm sekmeleri */}
                <div className="flex items-center gap-2">
                  {previewResult ? (
                    <div className="flex rounded-lg overflow-hidden"
                      style={{ border: '1px solid var(--border)' }}>
                      {(['current', 'preview'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)}
                          className="px-4 py-2 text-caption font-semibold transition-colors whitespace-nowrap"
                          style={view === v
                            ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)' }
                            : { background: 'var(--surface)', color: 'var(--tx3)' }
                          }>
                          {v === 'current' ? 'Mevcut Sıralama' : 'Önizleme'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-caption font-semibold" style={{ color: 'var(--tx2)' }}>Mevcut Sıralama</span>
                  )}
                </div>

                {/* Sağ: export + toggle + arama */}
                <div className="flex flex-wrap items-center gap-2">
                  {(manualOrder.length > 0 || previewOrder.length > 0) && (
                    <button onClick={handleExportCsv}
                      className="flex items-center gap-1.5 text-caption px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}
                      title="Sıralamayı CSV olarak indir"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc-bd)'; (e.currentTarget as HTMLElement).style.color = 'var(--acc-tx)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx2)'; }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      CSV
                    </button>
                  )}
                  {Object.keys(pinnedPositions).length > 0 && (
                    <button onClick={clearAllPins}
                      className="flex items-center gap-1.5 text-caption px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors"
                      style={{ background: 'var(--acc-bg)', border: '1px solid var(--acc-bd)', color: 'var(--acc-tx)' }}
                      title="Tüm sabitlemeleri kaldır">
                      <PinIcon pinned={false} />
                      Tüm Sabitlemeleri Kaldır ({Object.keys(pinnedPositions).length})
                    </button>
                  )}
                  {view === 'preview' && previewResult && previewResult.disqualifiedCount > 0 && (
                    <button onClick={() => setShowDq(v => !v)}
                      className="text-caption px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                      style={{
                        background: showDq ? 'var(--err-bg)' : 'var(--surface2)',
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
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input type="text" placeholder="Ara…" value={filter}
                      onChange={e => setFilter(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)', width: 'clamp(100px, 30vw, 160px)' }} />
                  </div>
                </div>
              </div>

              {/* Alt satır: istatistik rozetleri */}
              {((view === 'current' && currentResult) || (view === 'preview' && previewResult)) && (
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {view === 'current' && currentResult && (
                    <>
                      <span className="text-label font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
                        {currentResult.total} ürün
                      </span>
                      <span className="text-label font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--tx3)' }} />
                        T-Soft sıralaması · Puanlama uygulanmıyor
                      </span>
                    </>
                  )}
                  {view === 'preview' && previewResult && [
                    { label: 'Toplam',   val: previewResult.total,             bg: 'var(--surface2)', bd: 'var(--border)', tx: 'var(--tx2)'    },
                    { label: 'Aktif',    val: previewResult.qualifiedCount,    bg: 'var(--ok-bg)',    bd: 'var(--ok-bd)',  tx: 'var(--ok-tx)'  },
                    { label: 'Dışlanan', val: previewResult.disqualifiedCount, bg: 'var(--err-bg)',   bd: 'var(--err-bd)', tx: 'var(--err-tx)' },
                  ].map(s => (
                    <span key={s.label} className="text-label font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.tx }}>
                      {s.val} {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* İçerik */}
            <div style={{ padding: 'var(--spacing-card)', background: 'var(--panel)', borderRadius: '0 0 16px 16px' }}>
              {/* Yükleniyor */}
              {(currentStatus === 'loading' || previewStatus === 'loading') && (
                <div className="flex items-center justify-center gap-3 py-16">
                  <span className="w-6 h-6 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--border)', borderTopColor: 'var(--acc)' }} />
                  <span className="text-sm" style={{ color: 'var(--tx2)' }}>
                    {currentStatus === 'loading' ? 'Mevcut sıralama yükleniyor…' : 'Önizleme hesaplanıyor…'}
                  </span>
                </div>
              )}

              {/* Mevcut sıralama kartları — drag-drop */}
              {view === 'current' && currentStatus !== 'loading' && filteredCurrent.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredCurrent.map(p => p.productCode)} strategy={rectSortingStrategy}>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredCurrent.map(p => (
                        <SortableCurrentCard key={p.productCode} p={p} apiUrl={apiUrl} onRankEdit={handleRankEdit}
                          isPinned={pinnedPositions[p.productCode] !== undefined}
                          onTogglePin={togglePin} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Önizleme kartları — drag-drop */}
              {view === 'preview' && previewStatus !== 'loading' && filteredPreview.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePreviewDragEnd}>
                  <SortableContext items={filteredPreview.map(p => p.productCode)} strategy={rectSortingStrategy}>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredPreview.map(p => (
                        <SortablePreviewCard key={p.productCode} p={p} displayRank={p.finalRank}
                          criteria={previewResult!.criteria} apiUrl={apiUrl}
                          onRankEdit={handlePreviewRankEdit}
                          isPinned={pinnedPositions[p.productCode] !== undefined}
                          onTogglePin={togglePin} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Boş durum */}
              {!isBusy && hasProducts && filteredCurrent.length === 0 && view === 'current' && (
                <div className="flex items-center justify-center py-12 rounded-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--tx3)' }}>Ürün bulunamadı</p>
                </div>
              )}
              {!isBusy && previewResult && filteredPreview.length === 0 && view === 'preview' && (
                <div className="flex items-center justify-center py-12 rounded-lg"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--tx3)' }}>Ürün bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kategori seçilmemiş boş durum */}
        {!categoryId && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-[20px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 rounded-lg flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" className="w-7 h-7">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--tx2)' }}>
              Mevcut sıralamayı görmek için yukarıdan bir kategori seçin
            </p>
          </div>
        )}
      </div>

      {/* Sabit footer */}
      <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: 'var(--spacing-tight) var(--spacing-card)' }}>
        {/* Weight indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-label font-medium"
            style={total === 100
              ? { border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)', background: 'var(--ok-bg)' }
              : { border: '1px solid var(--warn-bd)', color: 'var(--warn-tx)', background: 'var(--warn-bg)' }
            }>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: total === 100 ? 'var(--ok-tx)' : 'var(--warn-tx)' }} />
            Ağırlık: {formatPercent(total)}
          </div>
          {total !== 100 && (
            <span className="text-caption" style={{ color: 'var(--tx3)' }}>
              ({total > 100 ? `${total - 100} fazla` : `${100 - total} eksik`})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCriteria(DEFAULT_CRITERIA)}
            className={`${btnCls} font-medium`}
            style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--tx2)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--tx2)'; }}>
            Varsayılan
          </button>

          <button onClick={handleSave} disabled={!isValid || isBusy}
            className={`${btnCls} font-semibold`}
            style={!isValid || isBusy ? btnDisabled : btnOutline}
            onMouseEnter={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx2)'; }}
            onMouseLeave={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}>
            {saveStatus === 'loading' ? 'Kaydediliyor…' : 'Kaydet'}
          </button>

          <button onClick={handlePreview} disabled={!isValid || isBusy}
            className={`${btnCls} font-semibold`}
            style={!isValid || isBusy ? btnDisabled : btnOutline}
            onMouseEnter={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--tx2)'; }}
            onMouseLeave={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}>
            {previewStatus === 'loading' ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--border)', borderTopColor: 'var(--tx1)' }} />
                Hesaplanıyor…
              </span>
            ) : 'Önizle'}
          </button>

          {/* Sıralamayı Uygula — manuel ise manuel, önizleme ise skorlu yazar */}
          <button
            onClick={canManual ? handleApplyManual : handleTrigger}
            disabled={!canApply || isApplying}
            title={applyTooltip}
            className={`${btnCls} px-5 font-bold`}
            style={!canApply || isApplying
              ? { background: 'var(--cta-bg)', color: 'var(--cta-tx)', opacity: 0.55, cursor: 'not-allowed', border: '1px solid transparent' }
              : { background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: '1px solid transparent', cursor: 'pointer' }
            }
            onMouseEnter={e => { if (canApply && !isApplying) (e.currentTarget as HTMLElement).style.background = 'var(--cta-hov)'; }}
            onMouseLeave={e => { if (canApply && !isApplying) (e.currentTarget as HTMLElement).style.background = 'var(--cta-bg)'; }}>
            {isApplying ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'var(--cta-tx)' }} />
                Uygulanıyor…
              </span>
            ) : applyLabel}
          </button>
        </div>
      </div>

      {/* AI sohbet — yüzen buton + panel */}
      {previewResult && (
        <>
          <button
            onClick={() => setChatOpen(v => !v)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'var(--cta-bg)', color: 'var(--cta-tx)' }}
          >
            {chatOpen ? (
              <span className="text-xl leading-none">✕</span>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            )}
            {!chatOpen && aiRules.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full text-label font-bold flex items-center justify-center"
                style={{ background: 'var(--err-tx)', color: 'white' }}>
                {aiRules.length}
              </span>
            )}
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 z-40 w-[380px] max-w-[calc(100vw-3rem)] flex flex-col overflow-hidden"
              style={{
                height: '540px', maxHeight: 'calc(100vh - 140px)',
                background: 'var(--surface)', border: '1.5px solid var(--border-strong)',
                borderRadius: '20px',
              }}>

              {/* Başlık */}
              <div className="shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>AI Sıralama Asistanı</div>
                  <div className="text-caption" style={{ color: 'var(--tx3)' }}>{categoryName || categoryId}</div>
                </div>
                <button onClick={() => setChatOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 shrink-0"
                  style={{ color: 'var(--tx3)' }}>✕</button>
              </div>

              {/* Mesaj akışı */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
                {messages.length === 0 && (
                  <p className="text-caption leading-relaxed" style={{ color: 'var(--tx3)' }}>
                    Önizleme sıralamasıyla ilgili bir talimat yazın, örn: <em>"ilk 100 sırada çanta kategorisinden ürün olmasın"</em>. Sonuç Önizleme sekmesine uygulanır.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i}
                    className="max-w-[85%] px-3 py-2 rounded-[20px] text-caption leading-snug"
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      ...(m.role === 'user'
                        ? { background: 'var(--cta-bg)', color: 'var(--cta-tx)' }
                        : m.isError
                          ? { background: 'var(--err-bg)', color: 'var(--err-tx)', border: '1px solid var(--err-bd)' }
                          : { background: 'var(--surface2)', color: 'var(--tx1)', border: '1px solid var(--border)' }),
                    }}>
                    {m.text}
                  </div>
                ))}
                {aiLoading && (
                  <div className="px-3 py-2 rounded-[20px] text-caption flex items-center gap-1.5"
                    style={{ alignSelf: 'flex-start', background: 'var(--surface2)', color: 'var(--tx3)' }}>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                    düşünüyor…
                  </div>
                )}
              </div>

              {/* Aktif kurallar */}
              {aiRules.length > 0 && (
                <div className="shrink-0 px-4 py-2.5 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                  {aiRules.map((r, i) => (
                    <span key={i}
                      className="text-label font-medium pl-2 pr-1 py-1 rounded-full flex items-center gap-1"
                      style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)' }}>
                      {r.description}
                      <button onClick={() => handleRemoveAiRule(i)} disabled={aiLoading}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:opacity-70 shrink-0 text-label"
                        style={{ background: 'rgba(0,0,0,0.08)' }}>
                        ✕
                      </button>
                    </span>
                  ))}
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
                  className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                />
                <button
                  onClick={handleAiInstruction}
                  disabled={aiLoading || !aiInstruction.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-all shrink-0"
                  style={aiLoading || !aiInstruction.trim()
                    ? { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)', cursor: 'not-allowed' }
                    : { background: 'var(--cta-bg)', color: 'var(--cta-tx)' }
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
