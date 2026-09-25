import { useRef, useCallback, useState, useEffect } from 'react';
import { CRITERION_COLORS, CRITERION_TEXT_ON, type WeightCriterion } from '../types';

interface Props {
  criteria: WeightCriterion[];
  onChange: (criteria: WeightCriterion[]) => void;
}

const MIN_WEIGHT = 5;

export function WeightBar({ criteria, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const weights = criteria.map(c => c.weight);
  const total   = weights.reduce((s, w) => s + w, 0);

  // Draft strings so user can clear and retype without being clamped mid-edit
  const [drafts, setDrafts] = useState<string[]>(() => weights.map(String));
  const weightsKey = weights.join(',');
  useEffect(() => {
    setDrafts(weights.map(String));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightsKey]);

  const startDrag = useCallback((dividerIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMove = (mv: MouseEvent) => {
      const pct = Math.round(((mv.clientX - rect.left) / rect.width) * 100);
      const next = [...weights];
      const cumBefore = next.slice(0, dividerIdx).reduce((s, w) => s + w, 0);
      const combined  = next[dividerIdx] + next[dividerIdx + 1];
      const newLeft   = Math.max(MIN_WEIGHT, Math.min(combined - MIN_WEIGHT, pct - cumBefore));
      next[dividerIdx]     = newLeft;
      next[dividerIdx + 1] = combined - newLeft;
      onChange(criteria.map((c, i) => ({ ...c, weight: next[i] })));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [criteria, weights, onChange]);

  function commitDraft(i: number) {
    const parsed = parseInt(drafts[i], 10);
    if (isNaN(parsed)) { setDrafts(weights.map(String)); return; }
    const val = Math.max(MIN_WEIGHT, Math.min(100, parsed));
    const remaining = 100 - val;
    const otherIdxs = criteria.map((_, j) => j).filter(j => j !== i);
    const otherSum  = otherIdxs.reduce((s, j) => s + weights[j], 0);
    const ws = [...weights];
    ws[i] = val;
    if (otherSum > 0) {
      let allocated = 0;
      for (let k = 0; k < otherIdxs.length - 1; k++) {
        const j = otherIdxs[k];
        ws[j] = Math.round((weights[j] / otherSum) * remaining);
        allocated += ws[j];
      }
      ws[otherIdxs[otherIdxs.length - 1]] = remaining - allocated;
    }
    onChange(criteria.map((c, j) => ({ ...c, weight: ws[j] })));
  }

  const off = total !== 100;
  // Divider i sits at the right edge of segment i, i.e. at the running total.
  const dividers = weights.slice(0, -1).map((_, i) => weights.slice(0, i + 1).reduce((s, w) => s + w, 0));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>Puan Dağılım Çubuğu</div>
          {off ? (
            <div role="alert" className="text-xs mt-0.5 font-medium" style={{ color: 'var(--err-tx)' }}>
              Toplam %100 olmalı — {total > 100 ? `${total - 100} puan fazla` : `${100 - total} puan eksik`}
            </div>
          ) : (
            <div className="text-xs mt-0.5" style={{ color: 'var(--tx3)' }}>Sürükleyerek ağırlıkları ayarlayın</div>
          )}
        </div>
        <span className="text-lg font-bold tabular-nums shrink-0 rounded-lg px-2 py-0.5"
          style={off
            ? { color: 'var(--err-tx)', background: 'var(--err-bg)', border: '1px solid var(--err-bd)' }
            : { color: 'var(--ok-tx)', border: '1px solid transparent' }}>
          {total}%
        </span>
      </div>

      {/* Draggable bar */}
      <div ref={containerRef}
        className="relative h-11 rounded-lg overflow-hidden flex select-none"
        style={{ border: '1px solid var(--border)' }}>
        {criteria.map((c, i) => (
          <div key={i}
            className="flex items-center justify-center text-xs font-bold overflow-hidden whitespace-nowrap"
            style={{
              width: `${c.weight}%`,
              background: CRITERION_COLORS[i] ?? CRITERION_COLORS[0],
              color: CRITERION_TEXT_ON[i] ?? CRITERION_TEXT_ON[0],
            }}>
            K{i + 1} · {c.weight}%
          </div>
        ))}

        {/* Handles — centred exactly on each segment boundary */}
        {dividers.map((pos, i) => (
          <div key={i}
            className="group absolute top-0 bottom-0 w-5 z-10 flex items-center justify-center"
            style={{ left: `${pos}%`, transform: 'translateX(-50%)', cursor: 'col-resize' }}
            onMouseDown={e => startDrag(i, e)}>
            <div className="w-1.5 h-6 rounded-full transition-transform group-hover:scale-y-125"
              style={{ background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(21,16,53,0.25), 0 1px 3px rgba(21,16,53,0.35)' }} />
          </div>
        ))}
      </div>

      {/* Numeric inputs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg px-4 py-3"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--tx2)' }}>Ağırlıklar</span>
        <div className="flex-1 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${criteria.length}, minmax(0, 1fr))` }}>
          {criteria.map((c, i) => (
            <label key={i} className="flex items-center justify-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CRITERION_COLORS[i] ?? CRITERION_COLORS[0] }} />
              <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--tx2)' }}>K{i + 1}</span>
              <span className="relative min-w-0 w-full max-w-[72px]">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Kriter ${i + 1} ağırlığı`}
                  value={drafts[i] ?? String(c.weight)}
                  onChange={e => {
                    const next = [...drafts];
                    next[i] = e.target.value;
                    setDrafts(next);
                  }}
                  onBlur={() => commitDraft(i)}
                  onKeyDown={e => { if (e.key === 'Enter') commitDraft(i); }}
                  className="w-full h-8 pl-2 pr-6 text-right text-sm font-bold tabular-nums rounded-lg focus:outline-none transition-all"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--tx3)' }}>%</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
