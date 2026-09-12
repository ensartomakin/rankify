import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const SIZE_PAD: Record<Size, string> = { sm: '6px 14px', md: '8px 20px' };
const SIZE_FONT: Record<Size, string> = { sm: '13px', md: '14px' };

/* Primary CTA: Bright Teal fill with Deep Space Violet text, 8px radius, no shadow —
   the single filled chromatic button in the system; scarcity is what makes it work. */
export function Button({
  variant = 'primary', size = 'md', loading = false, icon, fullWidth,
  disabled, children, className = '', ...rest
}: Props) {
  const isDisabled = disabled || loading;

  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    borderRadius: '8px',
    padding: SIZE_PAD[size],
    fontSize: SIZE_FONT[size],
    fontWeight: 500,
    fontFamily: "'Work Sans', sans-serif",
    letterSpacing: '-0.028em',
    width: fullWidth ? '100%' : undefined,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    transition: 'background .15s, border-color .15s, color .15s, opacity .15s',
    opacity: isDisabled && variant !== 'primary' ? 0.5 : 1,
    whiteSpace: 'nowrap',
  };

  const variantSt: React.CSSProperties =
    variant === 'primary' ? {
      background: isDisabled ? 'var(--surface3)' : 'var(--cta-bg)',
      color: isDisabled ? 'var(--tx3)' : 'var(--cta-tx)',
      border: '1px solid transparent',
    } :
    variant === 'secondary' ? {
      background: 'transparent',
      color: 'var(--tx1)',
      border: '1px solid var(--border-strong)',
    } :
    variant === 'danger' ? {
      background: isDisabled ? 'var(--surface3)' : 'transparent',
      color: isDisabled ? 'var(--tx3)' : 'var(--err-tx)',
      border: `1px solid ${isDisabled ? 'var(--border)' : 'var(--err-bd)'}`,
    } :
    { background: 'transparent', color: 'var(--tx2)', border: '1px solid transparent' };

  return (
    <button
      className={className}
      disabled={isDisabled}
      style={{ ...base, ...variantSt }}
      onMouseEnter={e => {
        if (isDisabled) return;
        const el = e.currentTarget as HTMLElement;
        if (variant === 'primary') el.style.background = 'var(--cta-hov)';
        else if (variant === 'secondary') el.style.background = 'var(--surface2)';
        else if (variant === 'ghost') el.style.background = 'var(--surface2)';
        else if (variant === 'danger') el.style.background = 'var(--err-bg)';
      }}
      onMouseLeave={e => {
        if (isDisabled) return;
        const el = e.currentTarget as HTMLElement;
        if (variant === 'primary') el.style.background = 'var(--cta-bg)';
        else if (variant === 'secondary') el.style.background = 'transparent';
        else if (variant === 'ghost') el.style.background = 'transparent';
        else if (variant === 'danger') el.style.background = 'transparent';
      }}
      {...rest}
    >
      {loading ? <Spinner size={14} color={variant === 'primary' ? 'var(--cta-tx)' : 'var(--tx3)'} /> : icon}
      {children}
    </button>
  );
}
