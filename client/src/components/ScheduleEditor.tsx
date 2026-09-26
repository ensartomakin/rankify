import { WEEK_DAYS, hourLabel, nextRunLabel, type ScheduleDraft } from '../utils/schedule';

/* Body of the "Otomatik Zamanlama" card (shown while the schedule is on):
   day chips, the run hours (several allowed) and the next run time. */
export function ScheduleEditor({ draft, onChange }: {
  draft: ScheduleDraft;
  onChange: (d: ScheduleDraft) => void;
}) {
  const toggleDay = (day: number) =>
    onChange({ ...draft, days: draft.days.includes(day) ? draft.days.filter(d => d !== day) : [...draft.days, day] });
  const addHour = (h: number) =>
    onChange({ ...draft, hours: [...new Set([...draft.hours, h])].sort((a, b) => a - b) });
  const removeHour = (h: number) => onChange({ ...draft, hours: draft.hours.filter(x => x !== h) });

  const next = nextRunLabel(draft);
  const free = Array.from({ length: 24 }, (_, h) => h).filter(h => !draft.hours.includes(h));

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Günler */}
        <div role="group" aria-label="Günler" className="flex gap-1">
          {WEEK_DAYS.map(([day, label]) => {
            const on = draft.days.includes(day);
            return (
              <button key={day} type="button" aria-pressed={on} onClick={() => toggleDay(day)}
                className="w-8 h-8 rounded-md text-caption font-semibold transition-colors"
                style={on
                  ? { background: 'var(--acc-bg)', color: 'var(--acc-tx)', border: '1px solid var(--acc-bd)', cursor: 'pointer' }
                  : { background: 'var(--surface2)', color: 'var(--tx2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Saatler: eklenen saat çipleri + yeni saat seçici */}
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.hours.map(h => (
            <span key={h} className="inline-flex items-center gap-1 h-8 pl-2.5 pr-1 rounded-md text-caption font-semibold tabular-nums"
              style={{ background: 'var(--surface2)', color: 'var(--tx1)', border: '1px solid var(--border)' }}>
              {hourLabel(h)}
              <button type="button" onClick={() => removeHour(h)} aria-label={`${hourLabel(h)} saatini kaldır`}
                className="w-5 h-5 flex items-center justify-center rounded hover:opacity-70"
                style={{ background: 'transparent', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}>
                ×
              </button>
            </span>
          ))}
          {free.length > 0 && (
            <select aria-label="Saat ekle" value=""
              onChange={e => { if (e.target.value !== '') addHour(Number(e.target.value)); }}
              className="h-8 px-2 rounded-md text-caption font-semibold cursor-pointer"
              style={{ background: 'var(--surface)', color: 'var(--tx2)', border: '1px dashed var(--border-strong)' }}>
              <option value="">+ Saat</option>
              {free.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          )}
        </div>
      </div>

      <p className="text-label" style={{ color: 'var(--tx3)' }}>
        {next ? `Sonraki: ${next}` : 'Gün ve saat seçin'} · İstanbul saati
      </p>
    </div>
  );
}
