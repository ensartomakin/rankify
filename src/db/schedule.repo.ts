import { query } from './client';
import { store } from './dev-store';

// Hesap geneli zamanlama kaldırıldı (zamanlama artık ranking_configs üzerinde,
// kategori bazlı). Eski tablodan yalnızca "zamanlamanız kapatıldı" bildirimi okunur.

const usePg = () => Boolean(process.env.DATABASE_URL);

/** True when the user's old account-wide schedule was switched off by the migration
 *  and they have not dismissed the notice yet. */
export async function hasLegacyScheduleNotice(userId: number): Promise<boolean> {
  if (usePg()) {
    const rows = await query<{ legacy_notice: boolean }>(
      'SELECT legacy_notice FROM schedule_settings WHERE user_id = $1', [userId]
    );
    return rows[0]?.legacy_notice ?? false;
  }
  return store.schedules.get(userId)?.legacyNotice ?? false;
}

export async function dismissLegacyScheduleNotice(userId: number): Promise<void> {
  if (usePg()) {
    await query('UPDATE schedule_settings SET legacy_notice = FALSE WHERE user_id = $1', [userId]);
    return;
  }
  const row = store.schedules.get(userId);
  if (row) store.schedules.set(userId, { ...row, legacyNotice: false });
}
