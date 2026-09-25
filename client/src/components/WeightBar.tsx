import { useRef, useCallback, useState, useEffect } from 'react';
import { formatPercent } from '../utils/format';
import { criteriaColor, CRITERION_LABELS, type WeightCriterion } from '../types';

interface Props {
  criteria: WeightCriterion[];
  onChange: (criteria: WeightCriterion[]) => void;
}

const MIN_WEIGHT = 5;
/* A segment at least this wide shows the criterion name instead of K1/K2… */
const NAME_LABEL_MIN_PX = 120;

export function WeightBar({ criteria, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBarWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
      <div>
        <div className="text-body font-semibold" style={{ color: 'var(--tx1)' }}>Puan Dağılım Çubuğu</div>
        {off ? (
          <div role="alert" className="text-caption mt-0.5 font-semibold" style={{ color: 'var(--err-tx)' }}>
            Toplam {formatPercent(total)}, {formatPercent(Math.abs(100 - total))} {total > 100 ? 'fazla' : 'eksik'}
          </div>
        ) : (
          <div className="text-caption mt-0.5" style={{ color: 'var(--tx3)' }}>Sürükleyerek ağırlıkları ayarlayın</div>
        )}
      </div>

      {/* Draggable bar */}
      <div ref={containerRef}
        className="relative h-11 rounded-lg overflow-hidden flex select-none"
        style={{ border: '1px solid var(--border)' }}>
        {criteria.map((c, i) => {
          const name  = CRITERION_LABELS[c.key];
          const wide  = barWidth * c.weight / 100 >= NAME_LABEL_MIN_PX;
          return (
            <div key={i} title={`${name} · ${formatPercent(c.weight)}`}
              className="flex items-center justify-center px-1.5 text-label font-semibold overflow-hidden whitespace-nowrap"
              style={{
                width: `${c.weight}%`,
                background: criteriaColor(i),
                color: '#FFFFFF',
                textShadow: '0 1px 2px rgba(21,16,53,0.45)',
              }}>
              <span className="truncate">{wide ? name : `K${i + 1}`} · {formatPercent(c.weight)}</span>
            </div>
          );
        })}

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
        style={{ background: 'var(--surface2)' }}>
        <span className="text-caption font-medium shrink-0" style={{ color: 'var(--tx2)' }}>Ağırlıklar</span>
        <div className="flex-1 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
          {criteria.map((c, i) => (
            <label key={i} title={CRITERION_LABELS[c.key]} className="flex items-center justify-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: criteriaColor(i) }} />
              <span className="text-label font-semibold shrink-0 cursor-help" style={{ color: 'var(--tx2)' }}>K{i + 1}</span>
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
                  className="w-full h-8 pl-6 pr-2 text-left text-body font-bold tabular-nums rounded-lg focus:outline-none transition-all"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx1)' }}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-label pointer-events-none" style={{ color: 'var(--tx3)' }}>%</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
