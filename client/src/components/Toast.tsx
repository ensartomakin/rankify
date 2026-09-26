import { useEffect } from 'react';
import type { ToastItem } from './useToasts';

const AUTO_CLOSE_MS = 4000;

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const isError = toast.kind === 'error';
  return (
    <div role={isError ? 'alert' : 'status'}
      className="pointer-events-auto flex items-start gap-3 w-[360px] max-w-full px-4 py-3 rounded-xl text-sm font-medium animate-fade-up"
      style={{
        // The tint tokens are translucent: layer them over the opaque panel colour.
        background: `linear-gradient(${isError ? 'var(--err-bg)' : 'var(--ok-bg)'}, ${isError ? 'var(--err-bg)' : 'var(--ok-bg)'}), var(--panel)`,
        border: `1px solid ${isError ? 'var(--err-bd)' : 'var(--ok-bd)'}`,
        color: isError ? 'var(--err-tx)' : 'var(--ok-tx)',
        boxShadow: 'var(--shadow-tooltip)',
      }}>
      <span aria-hidden="true" className="shrink-0">{isError ? '✕' : '✓'}</span>
      <span className="flex-1 min-w-0 break-words">{toast.text}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Bildirimi kapat"
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:opacity-70"
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
        ×
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite"
      className="fixed top-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
      {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}
