/* Per-category automatic run. Stored as day (0=Sun … 6=Sat) → hours, and
   evaluated in the schedule time zone (same as the server scheduler). */
export interface CategorySchedule {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;
}

export const SCHEDULE_TIMEZONE = 'Europe/Istanbul';

/* Chips in Monday-first order: [day number, chip label] */
export const WEEK_DAYS: [number, string][] = [
  [1, 'Pt'], [2, 'Sa'], [3, 'Ça'], [4, 'Pe'], [5, 'Cu'], [6, 'Ct'], [0, 'Pz'],
];
const DAY_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/* The card edits one set of days and one set of hours, applied to every chosen day. */
export interface ScheduleDraft { isEnabled: boolean; days: number[]; hours: number[] }

export function toDraft(s: CategorySchedule | undefined): ScheduleDraft {
  const dh = s?.dayHours ?? {};
  const days  = Object.keys(dh).map(Number).filter(d => (dh[d] ?? []).length > 0);
  const hours = [...new Set(days.flatMap(d => dh[d]))].sort((a, b) => a - b);
  return { isEnabled: s?.isEnabled ?? false, days, hours };
}

export function fromDraft(d: ScheduleDraft): CategorySchedule {
  const dayHours: Record<number, number[]> = {};
  if (d.hours.length > 0) for (const day of d.days) dayHours[day] = [...d.hours].sort((a, b) => a - b);
  return { isEnabled: d.isEnabled, dayHours };
}

export function sameDraft(a: ScheduleDraft, b: ScheduleDraft): boolean {
  const key = (d: ScheduleDraft) => JSON.stringify([d.isEnabled, [...d.days].sort(), [...d.hours].sort((x, y) => x - y)]);
  return key(a) === key(b);
}

/* Day of week and hour of a moment in the schedule time zone. */
function zoned(t: Date): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TIMEZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(t);
  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  return {
    day:  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd),
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? 0),
  };
}

/* "Pzt 09:00" — the next run at or after the next full hour, or null. */
export function nextRunLabel(d: ScheduleDraft, now = new Date()): string | null {
  if (!d.isEnabled || d.days.length === 0 || d.hours.length === 0) return null;
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  for (let k = 1; k <= 24 * 7 + 1; k++) {
    const t = new Date(start.getTime() + k * 3_600_000);
    const { day, hour } = zoned(t);
    if (d.days.includes(day) && d.hours.includes(hour)) return `${DAY_SHORT[day]} ${hourLabel(hour)}`;
  }
  return null;
}

/* "Pzt, Çar · 09:00, 17:00" (Monday-first), "Her gün · 09:00", or null when incomplete. */
export function scheduleSummary(d: ScheduleDraft): string | null {
  if (d.days.length === 0 || d.hours.length === 0) return null;
  const days = d.days.length === 7
    ? 'Her gün'
    : WEEK_DAYS.filter(([day]) => d.days.includes(day)).map(([day]) => DAY_SHORT[day]).join(', ');
  return `${days} · ${[...d.hours].sort((a, b) => a - b).map(hourLabel).join(', ')}`;
}
