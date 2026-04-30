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
  getCurrentRanking, previewRanking, applyManualRanking,
} from '../api/ranking';
import type {
  CurrentRankingResponse, CurrentRankItem,
  PreviewResponse, ProductPreviewItem,
} from '../api/ranking';
import { saveConfig } from '../api/config';
import { fetchGa4Status } from '../api/ga4';
import { getStoredThreshold } from '../utils/threshold';
import type { WeightCriterion, CriterionKey } from '../types';
import type { SavedConfig } from '../api/config';
import { SCENARIOS } from '../data/scenarios';
import type { Scenario } from '../data/scenarios';

const DEFAULT_CRITERIA: [WeightCriterion, WeightCriterion, WeightCriterion] = [
  { key: 'stockScore',  weight: 33, direction: 'desc' },
  { key: 'bestSeller',  weight: 33, direction: 'desc', salesPeriod: '14d' },
  { key: 'newness',     weight: 34, direction: 'desc' },
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

function fmtPct(n: number) {
  return '%' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ─── Placeholder ikonu ─── */
function ImgPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: 'var(--surface2)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
        className="w-10 h-10" style={{ color: 'var(--border-2)' }}>
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
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isPinned ? '1.5px solid var(--acc-bd)' : '1px solid var(--border)',
        boxShadow: isPinned ? '0 2px 12px rgba(226,50,96,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
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
              className="w-14 text-center text-xs font-bold rounded-full px-2 py-1 outline-none"
              style={{ background: 'var(--acc)', color: '#fff', border: '2px solid var(--acc)' }}
              onClick={e => e.stopPropagation()} />
          ) : (
            <button onClick={startEdit}
              className="text-xs font-bold px-2.5 py-1 rounded-full"
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
            ? { background: 'var(--acc)', color: '#fff', boxShadow: '0 2px 8px rgba(226,50,96,0.4)' }
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
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
        <span className="text-[11px] font-mono truncate min-w-0" style={{ color: 'var(--tx3)' }}>#{p.productCode}</span>
        <span className="text-[11px] shrink-0" style={{ color: 'var(--tx3)' }}>Stok: {p.totalStock.toLocaleString('tr-TR')}</span>
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
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'var(--surface)',
        border: isPinned ? '1.5px solid var(--acc-bd)' : p.isDisqualified ? '1.5px solid var(--err-bd)' : '1px solid var(--border)',
        boxShadow: isPinned ? '0 2px 12px rgba(226,50,96,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
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
              className="w-14 text-center text-xs font-bold rounded-full px-2 py-1 outline-none"
              style={{ background: 'var(--acc)', color: '#fff', border: '2px solid var(--acc)' }}
              onClick={e => e.stopPropagation()} />
          ) : (
            <button onClick={startEdit}
              className="text-xs font-bold px-2.5 py-1 rounded-full"
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start"
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
            ? { background: 'var(--acc)', color: '#fff', boxShadow: '0 2px 8px rgba(226,50,96,0.4)' }
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
              📌 Sabitlendi
            </span>
          </div>
        )}
        <a href={p.seoUrl
            ? (p.seoUrl.startsWith('http') ? p.seoUrl : `${apiUrl.replace(/\/$/, '')}/${p.seoUrl.replace(/^\//, '')}`)
            : `${apiUrl.replace(/\/$/, '')}/urun-detay/${p.productCode}`}
          target="_blank" rel="noopener noreferrer"
          className="text-[13px] font-semibold leading-snug line-clamp-2 hover:underline"
          style={{ color: 'var(--tx1)' }}>
          {p.productName || p.productCode}
        </a>
      </div>

      {/* Puan dağılımı */}
      <div className="px-3 pb-1">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {criteria.map(c => {
            const key = c.key as CriterionKey;
            const contrib = p.criteriaContributions[key] ?? 0;
            const GA4_LABELS: Partial<Record<CriterionKey, string>> = {
              ga4Views:          'GA4 Görüntülenme',
              ga4Sessions:       'GA4 Oturum',
              ga4Ctr:            'GA4 CTR',
              ga4ConversionRate: 'GA4 Dönüşüm',
            };
            const label =
              key === 'bestSeller'       ? `Satış (${c.weight}%)` :
              key === 'stockScore'       ? `Stok (${c.weight}%)` :
              key === 'newness'          ? `Yenilik (${c.weight}%)` :
              key === 'reviewScore'      ? `Yorum (${c.weight}%)` :
              key === 'availabilityScore'? `Bulunurluk (${c.weight}%)` :
              key === 'discountRate'     ? `İndirim (${c.weight}%)` :
              `${GA4_LABELS[key] ?? key} (${c.weight}%)`;
            let raw: string | number = '';
            if (key === 'stockScore')             raw = p.totalStock.toLocaleString('tr-TR');
            else if (key === 'bestSeller')        raw = p.sales14Days.toLocaleString('tr-TR');
            else if (key === 'newness')           raw = fmtDate(p.registrationDate);
            else if (key === 'reviewScore')       raw = p.reviewCount.toLocaleString('tr-TR');
            else if (key === 'availabilityScore') raw = fmtPct(p.availabilityRate * 100);
            else if (key === 'discountRate')      raw = `%${(p.discountRate ?? 0).toLocaleString('tr-TR')}`;
            else if (key === 'ga4Views')          raw = (p.ga4?.views ?? 0).toLocaleString('tr-TR');
            else if (key === 'ga4Sessions')       raw = (p.ga4?.sessions ?? 0).toLocaleString('tr-TR');
            else if (key === 'ga4Ctr')            raw = `${(p.ga4?.ctr ?? 0).toFixed(2)}%`;
            else if (key === 'ga4ConversionRate') raw = `${(p.ga4?.conversionRate ?? 0).toFixed(2)}%`;
            return (
              <div key={key} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]"
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
            <span className="text-[12px] font-bold" style={{ color: 'var(--tx1)' }}>Toplam</span>
            <span className="text-[13px] font-bold" style={{ color: 'var(--acc-tx)' }}>
              {fmtPct(p.rankingScore)}
            </span>
          </div>
        </div>
        {p.isDisqualified && p.disqualifyReason && (
          <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--err-tx)' }}>⚠ {p.disqualifyReason}</p>
        )}
      </div>

      <div className="px-3 py-2 flex items-center justify-between gap-2"
        style={{ borderTop: '1px solid var(--border)' }}>
        <span className="text-[11px] font-mono truncate min-w-0" style={{ color: 'var(--tx3)' }}>#{p.productCode}</span>
        <span className="text-[11px] shrink-0" style={{ color: 'var(--tx3)' }}>Stok: {p.totalStock.toLocaleString('tr-TR')}</span>
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

/* ─── Ana bileşen ─── */
type Status = 'idle' | 'loading' | 'success' | 'error';

const cardSt = { background: 'var(--surface)', border: '1.5px solid var(--border)', boxShadow: '0 2px 16px rgba(226,50,96,0.09), 0 1px 3px rgba(0,0,0,0.06)' };

interface Props { prefill?: SavedConfig; }

export function Dashboard({ prefill }: Props) {
  const [selectedCategories, setSelectedCategories] = useState<{ id: string; name: string }[]>(
    prefill ? [{ id: prefill.categoryId, name: prefill.categoryName ?? '' }] : []
  );
  const categoryId   = selectedCategories[0]?.id   ?? '';
  const categoryName = selectedCategories[0]?.name ?? '';
  const [threshold,    setThreshold]    = useState(prefill ? prefill.availabilityThreshold : getStoredThreshold());
  const [criteria,     setCriteria]     = useState<[WeightCriterion, WeightCriterion, WeightCriterion]>(
    prefill?.criteria ?? DEFAULT_CRITERIA
  );
  const [smartMix,        setSmartMix]        = useState(true);
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

  // Kriter/eşik değişince önizlemeyi sıfırla
  useEffect(() => {
    setPreviewResult(null);
    setPreviewStatus('idle');
    setPreviewError('');
    if (view === 'preview') setView('current');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, JSON.stringify(criteria), smartMix]);

  function togglePin(code: string, rank: number) {
    setPinnedPositions(prev => {
      const next = { ...prev };
      if (next[code] !== undefined) delete next[code];
      else next[code] = rank;
      localStorage.setItem(`rankify_pin_${categoryId}`, JSON.stringify(next));
      return next;
    });
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

  function handleCriterionChange(i: number, updated: WeightCriterion) {
    setCriteria(prev => { const n = [...prev] as typeof prev; n[i] = updated; return n; });
  }

  // DnD drag end
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setManualOrder(items => {
      const oldIdx = items.findIndex(p => p.productCode === active.id);
      const newIdx = items.findIndex(p => p.productCode === over.id);
      return arrayMove(items, oldIdx, newIdx).map((p, i) => ({ ...p, currentRank: i + 1 }));
    });
    setManualDirty(true);
  }

  // Rank numarası manuel değişince
  function handleRankEdit(code: string, newRank: number) {
    setManualOrder(items => {
      const clamped = Math.max(1, Math.min(items.length, newRank));
      const idx = items.findIndex(p => p.productCode === code);
      if (idx === -1) return items;
      const next = [...items];
      const [item] = next.splice(idx, 1);
      next.splice(clamped - 1, 0, item);
      return next.map((p, i) => ({ ...p, currentRank: i + 1 }));
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

    const header = ['Ürün Web Servis Kodu', 'Ürün Adı', 'Kategori Web Servis Kodu', 'Kategori Sıralaması'];
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
      const result = await previewRanking({ categoryId: categoryId.trim(), availabilityThreshold: threshold, criteria, smartMix });
      setPreviewResult(result);
      setPreviewOrder(applyPinnedPositions(result.products));
      setPreviewStatus('idle');
      setView('preview');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Önizleme hatası');
      setPreviewStatus('error');
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
      await applyManualRanking(
        categoryId.trim(),
        previewOrder.map(p => ({ productCode: p.productCode, rank: p.finalRank }))
      );
      // Ek kategoriler için algoritmayı çalıştır ve uygula
      for (const { id } of selectedCategories.slice(1)) {
        const result = await previewRanking({ categoryId: id, availabilityThreshold: threshold, criteria, smartMix });
        await applyManualRanking(id, result.products.map(p => ({ productCode: p.productCode, rank: p.finalRank })));
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
    <div className="h-full flex flex-col">
      {/* Başlık */}
      <div className="shrink-0 pt-5 pb-4 flex items-center justify-between gap-4 px-4 md:px-7"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-serif" style={{ fontSize: 'clamp(18px,4vw,28px)', fontWeight: 700, color: 'var(--tx1)', lineHeight: 1.2 }}>
          Sıralama Yöneticisi
        </h1>
        <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold"
          style={isValid
            ? { border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)', background: 'var(--ok-bg)' }
            : { border: '1px solid var(--border-2)', color: 'var(--tx3)', background: 'transparent' }
          }>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: isValid ? 'var(--ok-tx)' : 'var(--border-2)' }} />
          {isValid ? 'Hazır' : 'Yapılandırılıyor'}
        </div>
      </div>

      {/* Kaydırılabilir içerik */}
      <div className="flex-1 overflow-y-auto pb-8 space-y-6 px-4 md:px-7" style={{ paddingTop: '20px' }}>

        {/* Hero kategori arama alanı */}
        <div>
          {/* wrapper: border+shadow ama overflow:visible — dropdown taşabilsin */}
          <div className="relative" style={{
            borderRadius: '16px',
            border: categoryId ? '2px solid #E23260' : '2px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: categoryId
              ? '0 4px 24px rgba(226,50,96,0.14)'
              : '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}>
            {/* Search icon */}
            <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-5 h-5"
                style={{ color: categoryId ? '#E23260' : 'var(--tx3)' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
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
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none
                              flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(226,50,96,0.08)', border: '1px solid rgba(226,50,96,0.22)' }}>
                <span className="text-[11px] font-mono font-semibold" style={{ color: '#E23260' }}>
                  {selectedCategories.length > 1 ? `${selectedCategories.length} kategori` : `#${categoryId}`}
                </span>
              </div>
            )}
          </div>

          {/* Alt açıklama */}
          <p className="text-[12px] mt-3 px-1" style={{ color: 'var(--tx3)' }}>
            {selectedCategories.length === 0
              ? 'Sıralamayı yönetmek istediğiniz T-Soft kategorisini seçin'
              : selectedCategories.length === 1
              ? `"${categoryName || categoryId}" kategorisi seçildi — kriterlerinizi ayarlayın ve önizleyin`
              : `${selectedCategories.length} kategori seçildi — Kaydet veya Sıralamayı Uygula hepsine uygulanır`}
          </p>

          {/* Seçili kategori chip'leri */}
          {selectedCategories.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-3 px-1">
              {selectedCategories.map(({ id, name }, idx) => (
                <button key={id} type="button"
                  onClick={() => handleToggleCategory(id, name)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={idx === 0
                    ? { background: 'rgba(226,50,96,0.12)', border: '1px solid rgba(226,50,96,0.3)', color: '#E23260' }
                    : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
                  {idx === 0 && <span style={{ fontSize: '9px' }}>★</span>}
                  <span>{name || id}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3 opacity-60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ağırlık dağılımı */}
        <div style={{ ...cardSt, borderRadius: '16px' }}>
          {/* Kart başlık şeridi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28.3px', background: 'var(--surface3)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--acc-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tx2)' }}>
              Ağırlık Dağılımı
            </span>
          </div>
          {/* Kart içeriği */}
          <div style={{ padding: '24px 24.3px' }}>
            <WeightDonut criteria={criteria} />
            <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
              <WeightBar criteria={criteria} onChange={setCriteria} />
            </div>
          </div>
        </div>

        {/* Strateji Şablonları — ayrı kart */}
        <div ref={scenarioRef} style={{ borderRadius: '16px', overflow: 'hidden', border: '1.5px solid var(--acc-bd)', boxShadow: '0 2px 20px rgba(226,50,96,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Başlık */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(90deg, rgba(226,50,96,0.10) 0%, rgba(226,50,96,0.04) 100%)', borderBottom: '1px solid var(--acc-bd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--acc)', boxShadow: '0 2px 8px rgba(226,50,96,0.35)' }}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>⚡</span>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--acc-tx)' }}>Hazır Strateji Şablonları</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--tx3)' }}>Bir şablon seçin — kriterler otomatik doldurulur</div>
              </div>
            </div>
            {selectedScenario && (
              <button onClick={() => setSelectedScenario(null)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx3)', cursor: 'pointer' }}>
                Temizle
              </button>
            )}
          </div>

          {/* Senaryo ızgarası */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2" style={{ padding: '14px 16px', background: 'var(--surface)' }}>
            {SCENARIOS.map(s => {
              const isSelected = selectedScenario?.id === s.id;
              return (
                <button key={s.id}
                  onClick={() => { setCriteria(s.criteria); setSelectedScenario(isSelected ? null : s); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
                    padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                    border: isSelected ? '1.5px solid var(--acc-bd)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--acc-bg)' : 'var(--surface2)',
                    boxShadow: isSelected ? '0 0 0 3px rgba(226,50,96,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc-bd)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; } }}
                  onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; } }}>
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{s.emoji}</span>
                  <div className="text-[11px] font-bold leading-tight mt-0.5" style={{ color: isSelected ? 'var(--acc-tx)' : 'var(--tx1)' }}>{s.name}</div>
                  <div className="text-[10px] leading-tight" style={{ color: 'var(--tx3)' }}>{s.tagline}</div>
                </button>
              );
            })}
          </div>

          {/* Seçili senaryo açıklaması */}
          {selectedScenario && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: 'var(--acc-bg)', borderTop: '1px solid var(--acc-bd)' }}>
              <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0 }}>{selectedScenario.emoji}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--acc-tx)' }}>
                  {selectedScenario.name}
                  <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--tx3)' }}>· {selectedScenario.tagline}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tx2)', marginTop: '4px', lineHeight: 1.6 }}>
                  {selectedScenario.description}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sıralama Kriterleri */}
        <div style={{ ...cardSt, borderRadius: '16px' }}>
          {/* Kart başlık şeridi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28.3px', background: 'var(--surface3)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--acc-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tx2)' }}>
              Sıralama Kriterleri
            </span>
          </div>
          {/* Kart içeriği */}
          <div style={{ padding: '24px 24.3px' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {criteria.map((c, i) => (
                <CriterionCard key={i} index={i as 0 | 1 | 2} criterion={c}
                  usedKeys={criteria.map(x => x.key)}
                  onChange={u => handleCriterionChange(i, u)}
                  ga4Connected={ga4Connected} />
              ))}
            </div>
          </div>
        </div>

        {/* Beden Bulunurluk Eşiği */}
        <div style={{ ...cardSt, borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28.3px', background: 'var(--surface3)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--acc-bg)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tx2)' }}>
              Beden Bulunurluk Eşiği
            </span>
          </div>
          <div style={{ padding: '16px 28.3px' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm" style={{ color: 'var(--tx2)', maxWidth: '460px' }}>
                Bu eşiğin altındaki beden oranına sahip çok bedenli ürünler sıralamadan dışlanır
              </p>
              <span className="text-lg font-bold tabular-nums px-4 py-1.5 rounded-xl shrink-0 ml-6"
                style={{ background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' }}>
                %{Math.round(threshold * 100)}
              </span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full" />
            <div className="flex justify-between text-[10px] mt-2" style={{ color: 'var(--tx3)' }}>
              <span>%0 — Tümü dahil</span>
              <span>%50</span>
              <span>%100 — Tam stok</span>
            </div>
          </div>
        </div>

        {/* Smart Mix toggle */}
        <div style={{ ...cardSt, borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 28.3px', background: 'var(--surface3)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: smartMix ? 'var(--acc-bg)' : 'var(--surface3)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={smartMix ? 'var(--acc)' : 'var(--tx3)'} strokeWidth="2" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tx2)' }}>
              Smart Mix
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28.3px' }}>
            <p className="text-sm" style={{ color: 'var(--tx2)', maxWidth: '520px' }}>
              Aynı ürünün farklı renklerini ürün adına göre tespit eder, yan yana gelmelerini engeller
            </p>
            <button onClick={() => setSmartMix(v => !v)}
              className="relative shrink-0 ml-8"
              style={{ width: 48, height: 26, borderRadius: 13, background: smartMix ? 'var(--acc)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
              <span style={{
                position: 'absolute', top: 4, left: smartMix ? 26 : 4,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>

        {/* Mesajlar */}
        {previewError && previewStatus === 'error' && (
          <div className="px-5 py-3.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            ✕ Önizleme hatası: {previewError}
          </div>
        )}
        {currentError && currentStatus === 'error' && (
          <div className="px-5 py-3.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }}>
            ✕ Yükleme hatası: {currentError}
          </div>
        )}
        {message && (
          <div className="px-5 py-3.5 rounded-xl text-sm font-medium flex items-center gap-3"
            style={isConfigError
              ? { background: 'var(--err-bg)', border: '1px solid var(--err-bd)', color: 'var(--err-tx)' }
              : { background: 'var(--ok-bg)',  border: '1px solid var(--ok-bd)',  color: 'var(--ok-tx)'  }
            }>
            {isConfigError ? '✕' : '✓'} {message}
          </div>
        )}

        {/* Ürün listesi alanı */}
        {categoryId && (
          <div style={{ border: '1px solid var(--border)', borderRadius: '16px' }}>

            {/* Liste başlığı / araç çubuğu */}
            <div style={{ padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderRadius: '16px 16px 0 0' }}>
              {/* Üst satır: sekmeler + arama */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Sol: görünüm sekmeleri */}
                <div className="flex items-center gap-2">
                  {previewResult ? (
                    <div className="flex rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--border)' }}>
                      {(['current', 'preview'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)}
                          className="px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
                          style={view === v
                            ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)' }
                            : { background: 'var(--surface)', color: 'var(--tx3)' }
                          }>
                          {v === 'current' ? 'Mevcut Sıralama' : 'Önizleme'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold" style={{ color: 'var(--tx2)' }}>Mevcut Sıralama</span>
                  )}
                </div>

                {/* Sağ: export + toggle + arama */}
                <div className="flex flex-wrap items-center gap-2">
                  {(manualOrder.length > 0 || previewOrder.length > 0) && (
                    <button onClick={handleExportCsv}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors"
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
                  {view === 'preview' && previewResult && previewResult.disqualifiedCount > 0 && (
                    <button onClick={() => setShowDq(v => !v)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
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
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--tx2)' }}>
                        {currentResult.total} ürün
                      </span>
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
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
                    <span key={s.label} className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.tx }}>
                      {s.val} {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* İçerik */}
            <div style={{ padding: '16px 16.3px', background: 'var(--bg)', borderRadius: '0 0 16px 16px' }}>
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
                <div className="flex items-center justify-center py-12 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--tx3)' }}>Ürün bulunamadı</p>
                </div>
              )}
              {!isBusy && previewResult && filteredPreview.length === 0 && view === 'preview' && (
                <div className="flex items-center justify-center py-12 rounded-xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--tx3)' }}>Ürün bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kategori seçilmemiş boş durum */}
        {!categoryId && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--acc-bg)' }}>
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
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 28px' }}>
        {/* Weight indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
            style={total === 100
              ? { border: '1px solid var(--ok-bd)', color: 'var(--ok-tx)', background: 'var(--ok-bg)' }
              : { border: '1px solid var(--warn-bd)', color: 'var(--warn-tx)', background: 'var(--warn-bg)' }
            }>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{ background: total === 100 ? 'var(--ok-tx)' : 'var(--warn-tx)' }} />
            Ağırlık: {total}%
          </div>
          {total !== 100 && (
            <span className="text-[11px]" style={{ color: 'var(--tx3)' }}>
              ({total > 100 ? `${total - 100} fazla` : `${100 - total} eksik`})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCriteria(DEFAULT_CRITERIA)}
            className="px-4 py-2 rounded-xl text-[13px] font-medium transition-all whitespace-nowrap"
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--tx3)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; }}>
            Varsayılan
          </button>

          <button onClick={handleSave} disabled={!isValid || isBusy}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap"
            style={!isValid || isBusy
              ? { background: 'transparent', color: 'var(--tx3)', cursor: 'not-allowed', border: '1px solid var(--border)' }
              : { background: 'var(--ok-bg)', color: 'var(--ok-tx)', border: '1px solid var(--ok-bd)', cursor: 'pointer' }
            }>
            {saveStatus === 'loading' ? 'Kaydediliyor…' : 'Kaydet'}
          </button>

          <button onClick={handlePreview} disabled={!isValid || isBusy}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap"
            style={!isValid || isBusy
              ? { background: 'transparent', color: 'var(--tx3)', cursor: 'not-allowed', border: '1px solid var(--border)' }
              : { background: 'transparent', color: 'var(--tx1)', border: '1px solid var(--border-2)', cursor: 'pointer' }
            }
            onMouseEnter={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--acc)'; }}
            onMouseLeave={e => { if (isValid && !isBusy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; }}>
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
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={!canApply || isApplying
              ? { background: 'var(--surface2)', color: 'var(--tx3)', cursor: 'not-allowed', border: '1px solid var(--border)' }
              : { background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: '1px solid transparent', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }
            }>
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

    </div>
  );
}
