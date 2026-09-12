interface Item {
  label: string;
  value: string | number | null | undefined;
  tone?: string;
}

interface Props {
  items: Item[];
}

/* Dense "at a glance" stat row — thin dividers, tabular numbers, no card chrome.
   Missing values render as an em dash rather than a fabricated number. */
export function KpiStrip({ items }: Props) {
  return (
    <div className="shrink-0 flex overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
      {items.map((it, i) => (
        <div key={it.label} className="shrink-0 px-4 md:px-7 py-3"
          style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none', minWidth: '120px' }}>
          <div className="font-sans-tight text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--tx3)', letterSpacing: '0.06em' }}>
            {it.label}
          </div>
          <div className="tabular-nums" style={{ fontSize: '19px', color: it.tone ?? 'var(--tx1)', fontFamily: "'Inter Tight', 'Inter', sans-serif" }}>
            {it.value ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
