import type { ReactNode } from 'react';

interface Props {
  title?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  padding?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}

/* Card with 20px radius: hairline border defines the edge, no shadow — the larger
   radius (vs 8px controls) signals a different functional layer. */
export function Card({ title, icon, headerRight, padding = '20px', style, children }: Props) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      overflow: 'hidden',
      ...style,
    }}>
      {title && (
        <div className="flex items-center justify-between gap-2" style={{
          padding: '14px 20px',
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="w-6 h-6 flex items-center justify-center shrink-0" style={{ background: 'var(--acc-bg)', borderRadius: '8px' }}>
                {icon}
              </div>
            )}
            <span className="font-sans-tight text-xs uppercase tracking-widest truncate" style={{ color: 'var(--tx2)' }}>
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
