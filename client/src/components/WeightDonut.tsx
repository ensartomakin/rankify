import { PieChart, Pie, Cell } from 'recharts';
import { CRITERION_COLORS, CRITERION_LABELS, SALES_PERIOD_LABELS, type WeightCriterion, type SalesPeriod } from '../types';

interface Props {
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion];
}

export function WeightDonut({ criteria }: Props) {
  const data = criteria.map((c, i) => ({
    name: `K${i + 1}`,
    label: CRITERION_LABELS[c.key],
    value: c.weight,
    color: CRITERION_COLORS[i],
  }));

  return (
    <div className="flex items-center gap-8">
      {/* Donut */}
      <div className="relative shrink-0">
        <PieChart width={160} height={160}>
          <Pie data={data} cx={80} cy={80}
            innerRadius={50} outerRadius={72}
            paddingAngle={3} dataKey="value"
            strokeWidth={0} startAngle={90} endAngle={-270}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'var(--tx3)' }}>
            TOPLAM
          </span>
          <span className="text-xl font-bold leading-tight" style={{ color: 'var(--tx1)' }}>100%</span>
          <span className="text-[9px]" style={{ color: 'var(--tx3)' }}>dağılım</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2.5"
            style={{ background: d.color + '10', border: `1px solid ${d.color}20` }}>
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--tx1)' }}>Kriter {i + 1}</div>
                <div className="text-xs" style={{ color: 'var(--tx2)' }}>
                  {d.label} · {criteria[i].direction === 'desc' ? 'Azalan' : 'Artan'}
                  {criteria[i].key === 'bestSeller' && criteria[i].salesPeriod
                    ? ` · ${SALES_PERIOD_LABELS[criteria[i].salesPeriod as SalesPeriod] ?? criteria[i].salesPeriod}`
                    : ''}
                </div>
              </div>
            </div>
            <span className="text-base font-bold tabular-nums" style={{ color: d.color }}>
              {d.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
