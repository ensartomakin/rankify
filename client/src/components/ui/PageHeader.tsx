import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  /** Substring of `title` to render in Bright Teal — the brand's one-word-per-headline gesture. */
  accent?: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, accent, description, action }: Props) {
  const parts = accent && title.includes(accent) ? title.split(accent) : null;

  return (
    <div className="shrink-0 flex items-start justify-between gap-4 flex-wrap" style={{ padding: '28px 4px 20px' }}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="font-sans-tight text-[12px] font-medium uppercase mb-2" style={{ color: 'var(--tx3)', letterSpacing: '0.06em' }}>
            {eyebrow}
          </div>
        )}
        <h1 className="font-serif" style={{ fontSize: 'clamp(24px,3.4vw,32px)', color: 'var(--tx1)', lineHeight: 1.2 }}>
          {parts ? <>{parts[0]}<em>{accent}</em>{parts[1]}</> : title}
        </h1>
        {description && (
          <p className="text-sm mt-2" style={{ color: 'var(--tx2)', maxWidth: '560px', lineHeight: 1.5, letterSpacing: '-0.028em' }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
