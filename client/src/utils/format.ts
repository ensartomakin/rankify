/** Turkish percent notation: 34 → "%34", 12.5 (1 digit) → "%12,5". */
export function formatPercent(value: number, fractionDigits = 0): string {
  return '%' + value.toLocaleString('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
