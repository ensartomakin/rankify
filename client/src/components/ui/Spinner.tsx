interface Props {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = 'var(--acc-tx)' }: Props) {
  return (
    <span
      className="animate-spin shrink-0"
      style={{
        width: size, height: size,
        borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: color,
        display: 'inline-block',
      }}
    />
  );
}
