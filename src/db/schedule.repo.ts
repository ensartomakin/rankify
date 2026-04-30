import { query } from './client';
import { store } from './dev-store';

export interface ScheduleSettings {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;  // gün (0=Paz … 6=Cmt) → saat listesi
}

const DEFAULT_SCHEDULE: ScheduleSettings = { isEnabled: false, dayHours: {} };

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function getSchedule(userId: number): Promise<ScheduleSettings> {
  if (usePg()) {
    const rows = await query<{ is_enabled: boolean; day_hours: Record<string, number[]> }>(
      'SELECT is_enabled, day_hours FROM schedule_settings WHERE user_id = $1', [userId]
    );
    if (!rows[0]) return { ...DEFAULT_SCHEDULE };
    const dayHours: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(rows[0].day_hours)) {
      dayHours[Number(k)] = v;
    }
    return { isEnabled: rows[0].is_enabled, dayHours };
  }
  const row = store.schedules.get(userId);
  return row ? { ...row } : { ...DEFAULT_SCHEDULE };
}

export async function setSchedule(userId: number, s: ScheduleSettings): Promise<void> {
  if (usePg()) {
    await query(
      `INSERT INTO schedule_settings (user_id, is_enabled, day_hours)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
         SET is_enabled = EXCLUDED.is_enabled,
             day_hours  = EXCLUDED.day_hours`,
      [userId, s.isEnabled, JSON.stringify(s.dayHours)]
    );
    return;
  }
  store.schedules.set(userId, { ...s });
}

export async function getAllEnabledSchedules(): Promise<Array<ScheduleSettings & { userId: number; tenantId?: number }>> {
  if (usePg()) {
    const rows = await query<{ user_id: number; is_enabled: boolean; day_hours: Record<string, number[]>; tenant_id: number | null }>(
      `SELECT ss.user_id, ss.is_enabled, ss.day_hours, u.tenant_id
       FROM schedule_settings ss
       JOIN users u ON u.id = ss.user_id
       WHERE ss.is_enabled = TRUE`
    );
    return rows.map(r => {
      const dayHours: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(r.day_hours)) dayHours[Number(k)] = v;
      return { userId: r.user_id, isEnabled: r.is_enabled, dayHours, tenantId: r.tenant_id ?? undefined };
    });
  }
  return [...store.schedules.entries()]
    .filter(([, s]) => s.isEnabled)
    .map(([userId, s]) => ({ userId, ...s }));
}
