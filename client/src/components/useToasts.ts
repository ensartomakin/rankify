import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';
export interface ToastItem { id: number; text: string; kind: ToastKind; }

/* Toast queue: notify() adds a message, each one closes itself after 4s. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);
  const notify = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = ++nextId.current;
    setToasts(t => [...t, { id, text, kind }]);
  }, []);
  return { toasts, notify, dismiss };
}
