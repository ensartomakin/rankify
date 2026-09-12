import type { ReactNode } from 'react';

type Variant = 'accent' | 'ok' | 'err' | 'warn' | 'neutral';

interface Props {
  variant?: Variant;
  children: ReactNode;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

const VARIANT_ST: Record<Variant, React.CSSProperties> = {
  accent:  { background: 'var(--acc-bg)',  color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)' },
  ok:      { background: 'var(--ok-bg)',   color: 'var(--ok-tx)',  border: '1px solid var(--ok-bd)' },
  err:     { background: 'var(--err-bg)',  color: 'var(--err-tx)', border: '1px solid var(--err-bd)' },
  warn:    { background: 'var(--warn-bg)', color: 'var(--warn-tx)',border: '1px solid var(--warn-bd)' },
  neutral: { background: 'var(--surface2)', color: 'var(--tx3)',  border: '1px solid var(--border)' },
};

/* Tag radius (20px) per the type scale — not the fully-round nav-pill shape. */
export function Pill({ variant = 'neutral', children, icon, size = 'sm' }: Props) {
  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{
        ...VARIANT_ST[variant],
        gap: '5px',
        borderRadius: '20px',
        padding: size === 'sm' ? '3px 10px' : '5px 14px',
        fontSize: size === 'sm' ? '11px' : '12.5px',
        fontWeight: 500,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {children}
    </span>
  );
}
