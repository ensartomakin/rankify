interface Props {
  total: number;
}

export function WeightTotal({ total }: Props) {
  const isValid = total === 100;
  const diff    = total - 100;

  return (
    <div className={`rounded-xl p-4 border flex items-center justify-between transition-colors ${
      isValid
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`text-xl font-bold tabular-nums ${isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
          %{total}
        </span>
        <span className="text-sm text-slate-500">toplam ağırlık</span>
      </div>

      {isValid ? (
        <span className="text-sm font-medium text-emerald-600">✓ Hazır</span>
      ) : (
        <span className="text-sm font-medium text-amber-600">
          {diff > 0 ? `${diff} fazla` : `${Math.abs(diff)} eksik`}
        </span>
      )}
    </div>
  );
}
