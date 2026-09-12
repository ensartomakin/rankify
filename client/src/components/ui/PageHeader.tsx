import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

/* Hero Headline Block, scaled down for app page headers: PolySans-substitute (Inter Tight)
   at weight 400 only — never bolded, tight tracking carries the authority instead. */
export function PageHeader({ eyebrow, title, description, action }: Props) {
  return (
    <div className="shrink-0 flex items-start justify-between gap-4 flex-wrap" style={{ padding: '28px 4px 20px' }}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="font-display text-[13px] mb-2" style={{ color: 'var(--acc2-tx)' }}>
            {eyebrow}
          </div>
        )}
        <h1 className="font-display" style={{ fontSize: 'clamp(24px,3.4vw,32px)', color: 'var(--tx1)', lineHeight: 1.19, letterSpacing: '-0.64px' }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-2" style={{ color: 'var(--tx2)', maxWidth: '560px', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
