import type { ReactNode } from 'react';

interface Props {
  title?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  padding?: string;
  /** The signature cut-corner treatment for featured/editorial blocks. */
  asymmetric?: boolean;
  style?: React.CSSProperties;
  children: ReactNode;
}

/* Data Dashboard / Asymmetric Radius Card: Ash surface, no shadow — depth comes from
   surface-color contrast against the white canvas, never elevation. */
export function Card({ title, icon, headerRight, padding = '24px', asymmetric, style, children }: Props) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: asymmetric ? '6px 0px 0px 0px' : '8px',
      overflow: 'hidden',
      ...style,
    }}>
      {title && (
        <div className="flex items-center justify-between gap-2" style={{
          padding: '14px 24px',
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: 'var(--surface3)', borderRadius: '4px' }}>
                {icon}
              </div>
            )}
            <span className="font-display text-xs uppercase tracking-widest truncate" style={{ color: 'var(--tx2)' }}>
              {title}
            </span>
          </div>
          {headerRight}
        </div>
      )}
      <div style={{ padding }}>
        {children}
      </div>
    </div>
  );
}
