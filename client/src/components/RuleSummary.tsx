import { CRITERION_COLORS, CRITERION_LABELS, SALES_PERIOD_LABELS, type WeightCriterion, type SalesPeriod } from '../types';

interface Props {
  categoryId: string;
  categoryName?: string;
  criteria: [WeightCriterion, WeightCriterion, WeightCriterion];
  availabilityThreshold: number;
}

export function RuleSummary({ categoryId, categoryName, criteria, availabilityThreshold }: Props) {
  if (!categoryId) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full">
            Kategori Kural Özeti
          </span>
          <span className="text-xs text-slate-400">Seçilen kategori için aktif sıralama kuralları</span>
        </div>
        <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
          Beden eşiği: %{Math.round(availabilityThreshold * 100)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="bg-violet-100 text-violet-700 text-xs font-medium px-3 py-1 rounded-full">
          {categoryName || categoryId}
        </span>
      </div>

      {/* Criterion boxes */}
      <div className="grid grid-cols-3 gap-3">
        {criteria.map((c, i) => (
          <div key={i} className="border border-slate-100 rounded-xl p-3 space-y-1">
            <div className="text-sm font-semibold text-slate-700">{CRITERION_LABELS[c.key]}</div>
            <div className="text-xs text-slate-400">
              {c.direction === 'desc' ? 'Azalan' : 'Artan'}
              {c.key === 'bestSeller' && c.salesPeriod && ` · ${SALES_PERIOD_LABELS[c.salesPeriod as SalesPeriod] ?? c.salesPeriod}`}
            </div>
            <div className="text-base font-bold" style={{ color: CRITERION_COLORS[i] }}>
              %{c.weight}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
