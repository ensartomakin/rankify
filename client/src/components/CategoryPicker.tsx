import { useEffect, useRef, useState } from 'react';
import { fetchCategories, type TsoftCategory } from '../api/catalog';

interface Props {
  value:    string;
  label:    string;
  onChange: (id: string, name: string) => void;
  heroMode?: boolean;
  multiSelect?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string, name: string) => void;
}

function buildTree(cats: TsoftCategory[]) {
  const map = new Map<string, TsoftCategory[]>();
  for (const c of cats) {
    const pid = c.parentCategoryId ?? '0';
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(c);
  }
  function collect(parentId: string, depth: number): { cat: TsoftCategory; depth: number }[] {
    const children = map.get(parentId) ?? [];
    const result: { cat: TsoftCategory; depth: number }[] = [];
    for (const child of children) {
      result.push({ cat: child, depth });
      result.push(...collect(child.categoryId, depth + 1));
    }
    return result;
  }
  const ids = new Set(cats.map(c => c.categoryId));
  const rootParents = new Set(
    cats.filter(c => !ids.has(c.parentCategoryId) || c.parentCategoryId === '0').map(c => c.parentCategoryId)
  );
  return rootParents.size
    ? collect([...rootParents][0], 0)
    : cats.map(c => ({ cat: c, depth: 0 }));
}

export function CategoryPicker({ value, label, onChange, heroMode = false, multiSelect = false, selectedIds = [], onToggle }: Props) {
  const [open,       setOpen]       = useState(false);
  const [search,     setSearch]     = useState('');
  const [categories, setCategories] = useState<TsoftCategory[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function load() {
    if (categories.length) { setOpen(true); return; }
    setLoading(true); setError('');
    try {
      const cats = await fetchCategories();
      setCategories(cats);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  function handleItemClick(cat: TsoftCategory) {
    if (multiSelect && onToggle) {
      onToggle(cat.categoryId, cat.name);
      // Keep dropdown open for multi-select
    } else {
      onChange(cat.categoryId, cat.name);
      setOpen(false);
      setSearch('');
    }
  }

  const flat    = buildTree(categories);
  const q       = search.toLowerCase();
  const visible = q
    ? flat.filter(({ cat }) => cat.name.toLowerCase().includes(q) || cat.categoryId.includes(q))
    : flat;

  if (heroMode) {
    const selCount = multiSelect ? selectedIds.length : (value ? 1 : 0);
    const displayText = selCount === 0
      ? null
      : selCount === 1
      ? (label || value)
      : `${label || value} +${selCount - 1} daha`;

    return (
      <div ref={ref} className="relative">
        <button type="button" onClick={load}
          className="w-full text-left flex items-center focus:outline-none transition-all"
          style={{
            padding: '0 140px 0 52px',
            height: '62px',
            background: 'transparent',
            border: 'none',
            color: value ? 'var(--tx1)' : 'var(--tx3)',
          }}>
          {loading ? (
            <span className="flex items-center gap-3">
              <span className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--border)', borderTopColor: '#E23260' }} />
              <span className="text-base" style={{ color: 'var(--tx3)' }}>Yükleniyor…</span>
            </span>
          ) : displayText ? (
            <span className="text-base font-semibold truncate" style={{ color: 'var(--tx1)' }}>
              {displayText}
            </span>
          ) : (
            <span className="text-base" style={{ color: 'var(--tx3)' }}>
              Kategori seçin veya arayın…
            </span>
          )}
        </button>

        {error && <p className="text-xs mt-1.5 px-4" style={{ color: 'var(--err-tx)' }}>{error}</p>}

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-2xl max-h-80 flex flex-col overflow-hidden animate-fade-up"
            style={{ background: 'var(--surface)', border: '2px solid #E23260', boxShadow: '0 20px 60px rgba(226,50,96,0.18)' }}>
            <div className="p-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <input autoFocus type="text" placeholder="Kategori adı veya ID ara…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
              {multiSelect && selectedIds.length > 0 && (
                <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(226,50,96,0.1)', color: '#E23260' }}>
                  {selectedIds.length} seçildi
                </span>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {visible.length === 0 ? (
                <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--tx3)' }}>Sonuç bulunamadı</div>
              ) : visible.map(({ cat, depth }) => {
                const isSelected = multiSelect ? selectedIds.includes(cat.categoryId) : cat.categoryId === value;
                return (
                  <button key={cat.categoryId} type="button"
                    onClick={() => handleItemClick(cat)}
                    className="w-full text-left py-2.5 text-sm flex items-center gap-2 transition-colors"
                    style={{
                      paddingLeft: `${16 + depth * 16}px`,
                      paddingRight: '16px',
                      background: isSelected ? 'rgba(226,50,96,0.07)' : 'transparent',
                      color: isSelected ? '#E23260' : 'var(--tx2)',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {depth > 0 && <span className="text-xs shrink-0" style={{ color: 'var(--tx3)' }}>└</span>}
                    <span className="flex-1 truncate">{cat.name}</span>
                    <span className="text-xs font-mono shrink-0" style={{ color: 'var(--tx3)' }}>#{cat.categoryId}</span>
                    {multiSelect && (
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                        style={isSelected
                          ? { background: '#E23260', border: '1px solid #E23260' }
                          : { background: 'transparent', border: '1.5px solid var(--border)' }}>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-2.5 h-2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={load}
        className="w-full px-4 py-3 rounded-xl text-sm text-left flex items-center justify-between focus:outline-none transition-all"
        style={{
          background: 'var(--input-bg)',
          border: `1px solid ${open ? '#E23260' : 'var(--border)'}`,
          color: value ? 'var(--tx1)' : 'var(--tx-ph)',
        }}>
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin shrink-0"
                style={{ borderColor: 'var(--border)', borderTopColor: '#E23260' }} />
              <span style={{ color: 'var(--tx3)' }}>Yükleniyor…</span>
            </>
          ) : multiSelect && selectedIds.length > 0 ? (
            <>
              <span className="truncate">{label || selectedIds[0]}</span>
              {selectedIds.length > 1 && (
                <span className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(226,50,96,0.1)', color: '#E23260' }}>
                  +{selectedIds.length - 1}
                </span>
              )}
            </>
          ) : value ? (
            <>
              <span className="truncate">{label}</span>
              <span className="text-xs font-mono shrink-0" style={{ color: 'var(--tx3)' }}>#{value}</span>
            </>
          ) : (
            <span>Kategori seçin…</span>
          )}
        </span>
        <svg className={`w-4 h-4 transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--tx3)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && <p className="text-xs mt-1.5 px-1" style={{ color: 'var(--err-tx)' }}>{error}</p>}

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl max-h-72 flex flex-col overflow-hidden animate-fade-up"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div className="p-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <input autoFocus type="text" placeholder="Kategori ara…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--tx1)' }} />
            {multiSelect && selectedIds.length > 0 && (
              <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: 'rgba(226,50,96,0.1)', color: '#E23260' }}>
                {selectedIds.length}
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {visible.length === 0 ? (
              <div className="px-4 py-4 text-sm text-center" style={{ color: 'var(--tx3)' }}>Sonuç bulunamadı</div>
            ) : visible.map(({ cat, depth }) => {
              const isSelected = multiSelect ? selectedIds.includes(cat.categoryId) : cat.categoryId === value;
              return (
                <button key={cat.categoryId} type="button"
                  onClick={() => handleItemClick(cat)}
                  className="w-full text-left py-2.5 text-sm flex items-center gap-2 transition-colors"
                  style={{
                    paddingLeft: `${16 + depth * 16}px`,
                    paddingRight: '16px',
                    background: isSelected ? 'rgba(226,50,96,0.07)' : 'transparent',
                    color: isSelected ? '#E23260' : 'var(--tx2)',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {depth > 0 && <span className="text-xs shrink-0" style={{ color: 'var(--tx3)' }}>└</span>}
                  <span className="flex-1 truncate">{cat.name}</span>
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--tx3)' }}>#{cat.categoryId}</span>
                  {multiSelect && (
                    <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                      style={isSelected
                        ? { background: '#E23260', border: '1px solid #E23260' }
                        : { background: 'transparent', border: '1.5px solid var(--border)' }}>
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-2.5 h-2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
