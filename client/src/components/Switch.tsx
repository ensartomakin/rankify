/** On/off switch — teal when on. `md` is the settings-card size, `sm` fits toolbars. */
export function Switch({ checked, onChange, label, size = 'md' }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 'md' | 'sm';
}) {
  const d = size === 'md' ? { w: 48, h: 26, k: 18 } : { w: 32, h: 18, k: 12 };
  const pad = (d.h - d.k) / 2;
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative shrink-0"
      style={{ width: d.w, height: d.h, borderRadius: d.h / 2, background: checked ? 'var(--acc)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
      <span style={{
        position: 'absolute', top: pad, left: checked ? d.w - d.k - pad : pad,
        width: d.k, height: d.k, borderRadius: '50%', background: 'var(--knob)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}
