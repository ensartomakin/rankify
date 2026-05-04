import { useRef, useCallback } from 'react';
import { CRITERION_COLORS, type WeightCriterion } from '../types';

interface Props {
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion];
  onChange: (criteria: [WeightCriterion, WeightCriterion, WeightCriterion, WeightCriterion]) => void;
}

const MIN_WEIGHT = 5;

export function WeightBar({ criteria, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const weights = criteria.map(c => c.weight) as [number, number, number, number];
  const total   = weights.reduce((s, w) => s + w, 0);

  const startDrag = useCallback((dividerIdx: 0 | 1 | 2, e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMove = (mv: MouseEvent) => {
      const pct = Math.round(((mv.clientX - rect.left) / rect.width) * 100);
      const next: [number, number, number, number] = [...weights] as [number, number, number, number];
      const cumBefore = next.slice(0, dividerIdx).reduce((s, w) => s + w, 0);
      const combined  = next[dividerIdx] + next[dividerIdx + 1];
      const newLeft   = Math.max(MIN_WEIGHT, Math.min(combined - MIN_WEIGHT, pct - cumBefore));
      next[dividerIdx]     = newLeft;
      next[dividerIdx + 1] = combined - newLeft;
      onChange([
        { ...criteria[0], weight: next[0] },
        { ...criteria[1], weight: next[1] },
        { ...criteria[2], weight: next[2] },
        { ...criteria[3], weight: next[3] },
      ]);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [criteria, weights, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>Puan Dağılım Çubuğu</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--tx3)' }}>Sürükleyerek ağırlıkları ayarlayın</div>
        </div>
        <span className="text-lg font-bold tabular-nums"
          style={{ color: total === 100 ? 'var(--ok-tx)' : 'var(--warn-tx)' }}>
          {total}%
        </span>
      </div>

      {/* Draggable bar */}
      <div ref={containerRef}
        className="relative h-11 rounded-xl overflow-hidden flex select-none"
        style={{ cursor: 'col-resize', border: '1px solid var(--border)' }}>
        {criteria.map((c, i) => (
          <div key={i}
            className="relative flex items-center justify-center text-white text-xs font-bold transition-none"
            style={{ width: `${c.weight}%`, background: CRITERION_COLORS[i] + 'cc' }}>
            K{i + 1} · {c.weight}%
            {i < 3 && (
              <div className="absolute right-0 top-0 bottom-0 w-4 z-10 flex items-center justify-center"
                style={{ cursor: 'col-resize' }}
                onMouseDown={e => startDrag(i as 0 | 1 | 2, e)}>
                <div className="w-px h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Numeric inputs */}
      <div className="flex items-center gap-4 rounded-xl"
        style={{ padding: '12px 20.3px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--tx3)' }}>Ağırlıklar</span>
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CRITERION_COLORS[i] }} />
              <input type="number" min={MIN_WEIGHT} max={100} step={1}
                value={c.weight}
                onChange={e => {
                  const val = Math.max(MIN_WEIGHT, Math.min(100, Number(e.target.value)));
                  const next: [number, number, number, number] = [...weights] as [number, number, number, number];
                  next[i] = val;
                  const remaining  = 100 - val;
                  const otherIdxs  = ([0, 1, 2, 3] as const).filter(j => j !== i);
                  const otherSum   = otherIdxs.reduce((s, j) => s + next[j], 0);
                  if (otherSum > 0) {
                    let allocated = 0;
                    for (let k = 0; k < otherIdxs.length - 1; k++) {
                      const j = otherIdxs[k];
                      next[j] = Math.round((weights[j] / otherSum) * remaining);
                      allocated += next[j];
                    }
                    next[otherIdxs[otherIdxs.length - 1]] = remaining - allocated;
                  }
                  onChange([
                    { ...criteria[0], weight: next[0] },
                    { ...criteria[1], weight: next[1] },
                    { ...criteria[2], weight: next[2] },
                    { ...criteria[3], weight: next[3] },
                  ]);
                }}
                className="w-14 text-center text-sm font-bold rounded-lg py-1.5 focus:outline-none transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: CRITERION_COLORS[i] }}
              />
              <span className="text-xs" style={{ color: 'var(--tx3)' }}>%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
