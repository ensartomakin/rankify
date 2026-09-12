interface Props {
  status: 'success' | 'error';
}

export function StatusBadge({ status }: Props) {
  return status === 'success' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
      ✓ Başarılı
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      ✕ Hata
    </span>
  );
}
