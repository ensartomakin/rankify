import { useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { criteriaColor, CRITERION_LABELS, SALES_PERIOD_LABELS, type WeightCriterion, type SalesPeriod } from '../types';

interface Props {
  criteria: WeightCriterion[];
}

const SIZE = 176;

export function WeightDonut({ criteria }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const data = criteria.map((c, i) => ({
    name: `K${i + 1}`,
    label: CRITERION_LABELS[c.key],
    value: c.weight,
    color: criteriaColor(i),
  }));
  const hovered = active !== null ? data[active] : null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}
        onMouseLeave={() => setActive(null)}>
        <PieChart width={SIZE} height={SIZE}>
          {/* Gaps come from a panel-coloured stroke rather than paddingAngle, so
              they are the same width everywhere instead of wedge-shaped. */}
          <Pie data={data} cx={SIZE / 2} cy={SIZE / 2}
            innerRadius={58} outerRadius={82}
            paddingAngle={0} dataKey="value"
            stroke="var(--panel)" strokeWidth={3}
            startAngle={90} endAngle={-270}
            isAnimationActive={false}
            onMouseEnter={(_, i) => setActive(i)}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} fillOpacity={active === null || active === i ? 1 : 0.35}
                style={{ cursor: 'pointer', outline: 'none', transition: 'fill-opacity 0.15s' }} />
            ))}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
          aria-live="polite">
          {hovered ? (
            <>
              <span className="text-xl font-bold leading-tight tabular-nums" style={{ color: 'var(--tx1)' }}>
                %{hovered.value}
              </span>
              <span className="text-caption leading-tight max-w-[96px]" style={{ color: 'var(--tx2)' }}>
                {hovered.label}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold leading-tight tabular-nums" style={{ color: 'var(--tx1)' }}>
                {data.length}
              </span>
              <span className="text-caption leading-tight" style={{ color: 'var(--tx2)' }}>Kriter</span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 min-w-[220px] space-y-2" onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <div key={i} tabIndex={0}
            onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
            className="flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 outline-none transition-opacity"
            style={{
              background: d.color + '1A',
              boxShadow: `inset 3px 0 0 ${d.color}`,
              opacity: active === null || active === i ? 1 : 0.6,
            }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <div className="min-w-0">
                <div className="text-body font-semibold" style={{ color: 'var(--tx1)' }}>Kriter {i + 1}</div>
                <div className="text-caption" style={{ color: 'var(--tx2)' }}>
                  {d.label} · {criteria[i].direction === 'desc' ? 'Azalan' : 'Artan'}
                  {criteria[i].key === 'bestSeller' && criteria[i].salesPeriod
                    ? ` · ${SALES_PERIOD_LABELS[criteria[i].salesPeriod as SalesPeriod] ?? criteria[i].salesPeriod}`
                    : ''}
                </div>
              </div>
            </div>
            <span className="text-base font-bold tabular-nums shrink-0" style={{ color: 'var(--tx1)' }}>
              {d.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
