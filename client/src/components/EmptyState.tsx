/** Quiet placeholder for "nothing to show yet" states: an icon (or spinner),
 *  one short line of context, and at most one action. */
export function EmptyState({ icon, loading, title, description, action }: {
  icon?: React.ReactNode;
  loading?: boolean;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role={loading ? 'status' : undefined} aria-live={loading ? 'polite' : undefined}
      className="flex flex-col items-center justify-center text-center gap-stack py-12 px-card">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--acc-bg)', color: 'var(--acc)' }}>
        {loading
          ? <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--acc-bd)', borderTopColor: 'var(--acc)' }} />
          : icon}
      </div>
      <div className="flex flex-col gap-1 max-w-sm">
        <p className="text-body font-semibold" style={{ color: 'var(--tx1)' }}>{title}</p>
        {description && <p className="text-caption" style={{ color: 'var(--tx2)' }}>{description}</p>}
      </div>
      {action && (
        <button type="button" onClick={action.onClick}
          className="h-9 px-4 rounded-lg text-caption font-semibold transition-colors"
          style={{ background: 'transparent', color: 'var(--tx1)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
