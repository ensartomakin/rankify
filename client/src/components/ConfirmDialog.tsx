import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/* Small modal confirmation: Esc or a click on the backdrop cancels. */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'var(--scrim)' }} onMouseDown={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc"
        className="w-full max-w-[400px] rounded-2xl p-card flex flex-col gap-stack animate-fade-up"
        style={{ background: 'var(--panel)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-tooltip)' }}
        onMouseDown={e => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-body font-bold" style={{ color: 'var(--tx1)' }}>{title}</h2>
        <p id="confirm-desc" className="text-caption leading-relaxed" style={{ color: 'var(--tx2)' }}>{description}</p>
        <div className="flex justify-end gap-2 pt-tight">
          <button ref={cancelRef} type="button" onClick={onCancel}
            className="h-9 px-4 rounded-lg text-caption font-semibold"
            style={{ background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--tx1)', cursor: 'pointer' }}>
            Vazgeç
          </button>
          <button type="button" onClick={onConfirm}
            className="h-9 px-4 rounded-lg text-caption font-bold"
            style={{ background: 'var(--cta-bg)', color: 'var(--cta-tx)', border: '1px solid transparent', cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
