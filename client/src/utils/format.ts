/* Single home for number, percent and date formatting (Turkish locale). */
const LOCALE = 'tr-TR';

/** Turkish percent notation: 34 → "%34", 12.5 (1 digit) → "%12,5". */
export function formatPercent(value: number, fractionDigits = 0): string {
  return '%' + value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** 1234 → "1.234" */
export function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE);
}

type DateStyle =
  | 'long'      // 10 Ağu 2024
  | 'short'     // 10.08.24
  | 'datetime'  // 10.08.2024 14:03
  | 'full';     // 10.08.2024 14:03:22

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long:     { day: '2-digit', month: 'short', year: 'numeric' },
  short:    { day: '2-digit', month: '2-digit', year: '2-digit' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  full:     {},
};

/** Formats an ISO string or Date; invalid input renders as "—". */
export function formatDate(value: string | Date, style: DateStyle = 'long'): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return style === 'long' || style === 'short'
    ? d.toLocaleDateString(LOCALE, DATE_OPTIONS[style])
    : d.toLocaleString(LOCALE, DATE_OPTIONS[style]);
}
