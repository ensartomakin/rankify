import {
  CRITERION_COLORS, CRITERION_LABELS, SALES_PERIOD_LABELS, GA4_CRITERION_KEYS,
  type CriterionKey, type SalesPeriod, type SortDirection, type WeightCriterion,
} from '../types';

const BASE_KEYS: CriterionKey[] = ['stockScore', 'bestSeller', 'newness', 'reviewScore', 'discountRate'];
const GA4_KEYS:  CriterionKey[] = ['ga4Views', 'ga4Sessions', 'ga4Ctr', 'ga4ConversionRate'];

interface Props {
  index: 0 | 1 | 2;
  criterion: WeightCriterion;
  usedKeys: CriterionKey[];
  onChange: (c: WeightCriterion) => void;
  ga4Connected?: boolean;
}

export function CriterionCard({ index, criterion, usedKeys, onChange, ga4Connected = false }: Props) {
  const color   = CRITERION_COLORS[index];
  const allKeys = ga4Connected ? [...BASE_KEYS, ...GA4_KEYS] : BASE_KEYS;
  const options = allKeys.filter(k => k === criterion.key || !usedKeys.includes(k));

  const selectSt: React.CSSProperties = {
    width: '100%',
    padding: '9px 32.3px 9px 12.3px',
    borderRadius: '10px',
    fontSize: '13px',
    background: 'var(--input-bg)',
    border: '1px solid var(--border)',
    color: 'var(--tx1)',
    appearance: 'none',
    cursor: 'pointer',
    outline: 'none',
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      /* Sol aksan — overflow:hidden gerekmez, metin kırpılmaz */
      boxShadow: `inset 4px 0 0 ${color}, 0 1px 6px rgba(0,0,0,0.05)`,
    }}>
      {/* Başlık */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14.3px 12px 18.3px',
        background: color + '12',
        borderBottom: '1px solid var(--border)',
        borderRadius: '14px 14px 0 0',
      }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color }}>
            Kriter {index + 1}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: 'var(--tx1)' }}>
            {CRITERION_LABELS[criterion.key]}
          </div>
        </div>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, flexShrink: 0,
          background: color + '18', color,
        }}>
          K{index + 1}
        </div>
      </div>

      {/* İçerik */}
      <div style={{ padding: '16px 16.3px' }}>
        {/* Progress bar */}
        <div style={{ height: '5px', borderRadius: '9999px', overflow: 'hidden', background: 'var(--border)', marginBottom: '14px' }}>
          <div style={{ height: '100%', borderRadius: '9999px', width: `${criterion.weight}%`, background: color, transition: 'width 0.3s' }} />
        </div>

        {/* Sıralama Türü */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: '5px' }}>
            Sıralama Türü
          </label>
          <div style={{ position: 'relative' }}>
            <select value={criterion.key}
              onChange={e => onChange({ ...criterion, key: e.target.value as CriterionKey, salesPeriod: undefined })}
              style={selectSt}>
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
            </select>
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--tx3)', pointerEvents: 'none' }}>▼</span>
          </div>
        </div>

        {/* Sıralama Yönü */}
        <div style={{ marginBottom: criterion.key === 'bestSeller' ? '12px' : '0' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: '5px' }}>
            Sıralama Yönü
          </label>
          <div style={{ position: 'relative' }}>
            <select value={criterion.direction}
              onChange={e => onChange({ ...criterion, direction: e.target.value as SortDirection })}
              style={selectSt}>
              <option value="desc">Azalan</option>
              <option value="asc">Artan</option>
            </select>
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--tx3)', pointerEvents: 'none' }}>▼</span>
          </div>
        </div>

        {/* Best Seller period */}
        {criterion.key === 'bestSeller' && (
          <div style={{ borderRadius: '10px', padding: '10px 12px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: '5px' }}>
              Satış Dönemi
            </label>
            <div style={{ position: 'relative' }}>
              <select value={criterion.salesPeriod ?? '14d'}
                onChange={e => onChange({ ...criterion, salesPeriod: e.target.value as SalesPeriod })}
                style={selectSt}>
                {(Object.keys(SALES_PERIOD_LABELS) as SalesPeriod[]).map(k => (
                  <option key={k} value={k}>{SALES_PERIOD_LABELS[k]}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: 'var(--tx3)', pointerEvents: 'none' }}>▼</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
