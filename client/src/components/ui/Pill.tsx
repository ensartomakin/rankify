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
  neutral: { background: 'var(--surface3)', color: 'var(--tx2)',  border: '1px solid var(--border)' },
};

export function Pill({ variant = 'neutral', children, icon, size = 'sm' }: Props) {
  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{
        ...VARIANT_ST[variant],
        gap: '5px',
        borderRadius: '9999px',
        padding: size === 'sm' ? '3px 12px' : '5px 16px',
        fontSize: size === 'sm' ? '12px' : '13px',
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
