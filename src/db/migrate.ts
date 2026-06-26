import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './client';
import { logger } from '../utils/logger';
import { producerExists, createUser } from './user.repo';

export async function runMigrations(): Promise<void> {
  const sql = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  );

  await pool.query(sql);

  // ga4_product_metrics: ctr → cart_adds (sepete ekleme sayısı)
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='ga4_product_metrics' AND column_name='ctr') THEN
        ALTER TABLE ga4_product_metrics RENAME COLUMN ctr TO cart_adds;
        ALTER TABLE ga4_product_metrics ALTER COLUMN cart_adds TYPE INTEGER USING cart_adds::integer;
      END IF;
    END $$;
  `);

  logger.info('DB migration tamamlandı');

  // PRODUCER_EMAIL + PRODUCER_PASSWORD env varsa ve producer yoksa otomatik oluştur
  const email    = process.env.PRODUCER_EMAIL;
  const password = process.env.PRODUCER_PASSWORD;
  if (email && password) {
    const exists = await producerExists();
    if (!exists) {
      const hash = await bcrypt.hash(password, 12);
      await createUser(email, hash, 'Üretici', 'producer', undefined);
      logger.info(`Producer hesabı oluşturuldu: ${email}`);
    }
  }
}
