import {
  criteriaColor, CRITERION_LABELS, SALES_PERIOD_LABELS, GA4_CRITERION_KEYS,
  type CriterionKey, type SalesPeriod, type SortDirection, type WeightCriterion,
} from '../types';

const BASE_KEYS:   CriterionKey[] = ['stockScore', 'bestSeller', 'newness', 'reviewScore', 'discountRate'];
const GA4_KEYS:    CriterionKey[] = ['ga4Views', 'ga4CartAdds', 'ga4ConversionRate'];

interface Props {
  index: number;
  criterion: WeightCriterion;
  usedKeys: CriterionKey[];
  onChange: (c: WeightCriterion) => void;
  onRemove?: () => void;
  ga4Connected?: boolean;
}

export function CriterionCard({ index, criterion, usedKeys, onChange, onRemove, ga4Connected = false }: Props) {
  const color   = criteriaColor(index);
  const allKeys = [...BASE_KEYS, ...(ga4Connected ? GA4_KEYS : [])];
  const options = allKeys.filter(k => k === criterion.key || !usedKeys.includes(k));

  const hasPeriod = criterion.key === 'bestSeller' || GA4_CRITERION_KEYS.has(criterion.key);

  return (
    <div className="flex flex-col gap-stack p-card"
      style={{
        background: 'var(--crit-card-bg)',
        border: '1px solid var(--crit-card-bd)',
        /* The colour is the card's own left border, so it follows the corner radius. */
        borderLeft: `3px solid ${color}`,
        borderRadius: 'var(--radius-crit)',
      }}>
      <div className="flex items-center justify-between gap-tight">
        <span className="text-label font-bold uppercase tracking-wide" style={{ color: 'var(--tx2)' }}>
          Kriter {index + 1}
        </span>
        {onRemove && (
          <button onClick={onRemove}
            title="Kriteri kaldır"
            aria-label={`Kriter ${index + 1}'i kaldır`}
            className="w-6 h-6 flex items-center justify-center rounded-md text-body leading-none"
            style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--tx3)' }}>
            ×
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack">
        <Field label="Sıralama Türü">
          <Select value={criterion.key}
            onChange={v => onChange({ ...criterion, key: v as CriterionKey, salesPeriod: undefined })}>
            {options.filter(k => !GA4_CRITERION_KEYS.has(k)).map(k =>
              <option key={k} value={k}>{CRITERION_LABELS[k]}</option>
            )}
            {ga4Connected && options.some(k => GA4_CRITERION_KEYS.has(k)) && (
              <optgroup label="── Google Analytics 4 ──">
                {options.filter(k => GA4_CRITERION_KEYS.has(k)).map(k =>
                  <option key={k} value={k}>{CRITERION_LABELS[k]}</option>
                )}
              </optgroup>
            )}
          </Select>
        </Field>

        <Field label="Sıralama Yönü">
          <Select value={criterion.direction}
            onChange={v => onChange({ ...criterion, direction: v as SortDirection })}>
            <option value="desc">Azalan</option>
            <option value="asc">Artan</option>
          </Select>
        </Field>

        {hasPeriod && (
          <Field label={criterion.key === 'bestSeller' ? 'Satış Dönemi' : 'Veri Dönemi'}>
            {criterion.key === 'bestSeller' ? (
              <Select value={criterion.salesPeriod ?? '14d'}
                onChange={v => onChange({ ...criterion, salesPeriod: v as SalesPeriod })}>
                {(Object.keys(SALES_PERIOD_LABELS) as SalesPeriod[]).map(k => (
                  <option key={k} value={k}>{SALES_PERIOD_LABELS[k]}</option>
                ))}
              </Select>
            ) : (
              <Select value={criterion.salesPeriod ?? '1m'}
                onChange={v => onChange({ ...criterion, salesPeriod: v as SalesPeriod })}>
                {(['3d','7d','14d','1m','3m'] as SalesPeriod[]).map(k => (
                  <option key={k} value={k}>{SALES_PERIOD_LABELS[k]}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-label font-semibold" style={{ color: 'var(--tx2)' }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 rounded-lg text-caption appearance-none cursor-pointer outline-none"
        style={{ background: 'var(--input-bg)', border: '1px solid var(--border-strong)', color: 'var(--tx1)' }}>
        {children}
      </select>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: 'var(--tx3)' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
