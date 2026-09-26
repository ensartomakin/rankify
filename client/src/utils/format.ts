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

/** "26 Eyl 2026, 14:30" */
export function formatDateTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`;
}

/** "az önce", "5 dakika önce", "2 saat önce", "dün", "3 gün önce" … */
export function formatRelative(value: string | Date, now = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '—';
  const sec = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return 'az önce';
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000],
  ];
  let unit: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const u of units) if (abs >= u[1]) unit = u;
  return rtf.format(Math.round(sec / unit[1]), unit[0]);
}
