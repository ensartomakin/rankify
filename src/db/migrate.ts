import fs from 'fs';
import path from 'path';
import { pool } from './client';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const sql = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  );

  await pool.query(sql);
  logger.info('DB migration tamamlandı');
}
