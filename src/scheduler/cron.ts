import cron from 'node-cron';
import { runAllCategories } from '../pipeline/orchestrator';
import { getAllActiveConfigs } from '../db/config.repo';
import { getAllEnabledSchedules } from '../db/schedule.repo';
import { logger } from '../utils/logger';

// Her saat başı çalışır; aktif zamanlamaya sahip kullanıcıları kontrol eder
export function startScheduler(): void {
  cron.schedule(
    '0 * * * *',
    async () => {
      const now = new Date();
      const currentDay  = now.getDay();   // 0=Paz, 1=Pzt, ..., 6=Cmt
      const currentHour = now.getHours(); // 0-23

      let schedules: Awaited<ReturnType<typeof getAllEnabledSchedules>>;
      try {
        schedules = await getAllEnabledSchedules();
      } catch (err) {
        logger.error(`Zamanlama listesi alınamadı: ${err}`);
        return;
      }

      const dueUsers = schedules.filter(s => {
        const hours = s.dayHours[currentDay] ?? [];
        return hours.includes(currentHour);
      });

      if (dueUsers.length === 0) return;

      let allConfigs: Awaited<ReturnType<typeof getAllActiveConfigs>>;
      try {
        allConfigs = await getAllActiveConfigs();
      } catch (err) {
        logger.error(`Konfigürasyon listesi alınamadı: ${err}`);
        return;
      }

      for (const { userId, tenantId } of dueUsers) {
        const userConfigs = allConfigs
          .filter(c => c.userId === userId)
          .map(c => ({ ...c, userId, tenantId }));

        if (userConfigs.length === 0) {
          logger.warn(`Kullanıcı ${userId} için aktif kategori konfigürasyonu bulunamadı`);
          continue;
        }

        logger.info(`Otomatik sıralama: kullanıcı=${userId} kategori=${userConfigs.length}`);
        await runAllCategories(userConfigs, 'cron').catch(err =>
          logger.error(`Kullanıcı ${userId} otomatik sıralama hatası: ${err}`)
        );
      }
    },
    { timezone: 'Europe/Istanbul' }
  );

  logger.info('Scheduler aktif — her saat başı kullanıcı zamanlamaları kontrol edilir');
}
