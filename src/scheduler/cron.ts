import cron from 'node-cron';
import { runAllCategories } from '../pipeline/orchestrator';
import { getScheduledConfigs } from '../db/config.repo';
import { logger } from '../utils/logger';
import { listGa4Owners } from '../db/ga4.repo';
import { syncUsedGa4Ranges } from '../services/ga4-sync';

export const SCHEDULE_TIMEZONE = 'Europe/Istanbul';

/* Day of week (0=Sun … 6=Sat) and hour in the schedule time zone, independent of
   the server's own time zone. */
function nowInScheduleZone(now = new Date()): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHEDULE_TIMEZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const wd   = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const day  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  return { day, hour };
}

// Her saat başı çalışır; zamanlaması açık olan kategorilerden o gün/saate denk
// gelenleri, kategorinin son kaydedilmiş ayarlarıyla (kriterler, eşik, Smart Mix,
// sezon) sıralar. Geçmişe "Otomatik" (cron) olarak yazılır.
export function startScheduler(): void {
  cron.schedule(
    '0 * * * *',
    async () => {
      const { day, hour } = nowInScheduleZone();

      let configs: Awaited<ReturnType<typeof getScheduledConfigs>>;
      try {
        configs = await getScheduledConfigs();
      } catch (err) {
        logger.error(`Zamanlanmış kategori listesi alınamadı: ${err}`);
        return;
      }

      const due = configs.filter(c => (c.schedule.dayHours[day] ?? []).includes(hour));
      if (due.length === 0) return;

      // Kullanıcı başına sırayla (mağaza API'sini aynı anda yormamak için)
      const byUser = new Map<number, typeof due>();
      for (const c of due) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c]);

      for (const [userId, list] of byUser) {
        logger.info(`Otomatik sıralama: kullanıcı=${userId} kategori=${list.map(c => c.categoryId).join(',')}`);
        await runAllCategories(list, 'cron').catch(err =>
          logger.error(`Kullanıcı ${userId} otomatik sıralama hatası: ${err}`)
        );
      }
    },
    { timezone: SCHEDULE_TIMEZONE }
  );

  // Günlük GA4 senkronizasyonu (06:00 İstanbul): kategorilerin kullandığı tüm dönemler.
  // Zamanlanmış sıralama ayrıca veri 6 saatten eskiyse çalışmadan önce yeniler.
  cron.schedule(
    '0 6 * * *',
    async () => {
      const owners = await listGa4Owners().catch(err => { logger.error(`GA4 sahipleri alınamadı: ${err}`); return []; });
      for (const { userId, tenantId } of owners) {
        const results = await syncUsedGa4Ranges(userId, tenantId);
        const failed = results.filter(r => r.error);
        if (failed.length) logger.warn(`[GA4 günlük sync] owner=${userId} başarısız: ${failed.map(f => `${f.range}: ${f.error}`).join('; ')}`);
      }
    },
    { timezone: SCHEDULE_TIMEZONE }
  );

  logger.info('Scheduler aktif — her saat başı kategori zamanlamaları, her gün 06:00 GA4 senkronizasyonu');
}
