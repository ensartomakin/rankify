interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, disabled, size = 'md' }: Props) {
  const w = size === 'md' ? 44 : 34;
  const h = size === 'md' ? 24 : 19;
  const knob = h - 8;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative shrink-0"
      style={{
        width: w, height: h, borderRadius: 9999,
        background: checked ? 'var(--acc)' : 'var(--border-strong)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 4, left: checked ? w - knob - 4 : 4,
        width: knob, height: knob, borderRadius: '50%', background: '#fff',
        transition: 'left .2s',
      }} />
    </button>
  );
}
