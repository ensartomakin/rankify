import { store, type DevConfig } from './dev-store';
import { query } from './client';
import type { WeightConfig, WeightCriterion } from '../types/product';

const usePg = () => Boolean(process.env.DATABASE_URL);

function devRowToConfig(row: DevConfig) {
  return {
    id:                    row.id,
    userId:                row.userId,
    categoryId:            row.categoryId,
    categoryName:          row.categoryName,
    availabilityThreshold: row.availabilityThreshold,
    criteria:              row.criteria as WeightConfig['criteria'],
    isActive:              row.isActive,
  };
}

interface PgConfigRow {
  id: number; user_id: number; category_id: string; category_name: string | null;
  availability_threshold: string; criteria: WeightCriterion[]; is_active: boolean;
}

function pgRowToConfig(r: PgConfigRow) {
  return {
    id:                    r.id,
    userId:                r.user_id,
    categoryId:            r.category_id,
    categoryName:          r.category_name ?? undefined,
    availabilityThreshold: parseFloat(r.availability_threshold),
    criteria:              r.criteria as WeightConfig['criteria'],
    isActive:              r.is_active,
  };
}

export async function getAllActiveConfigs() {
  if (usePg()) {
    const rows = await query<PgConfigRow>(
      'SELECT * FROM ranking_configs WHERE is_active = TRUE ORDER BY created_at ASC'
    );
    return rows.map(pgRowToConfig);
  }
  return [...store.configs.values()].filter(c => c.isActive).map(devRowToConfig);
}

export async function getAllConfigs(userId: number) {
  if (usePg()) {
    const rows = await query<PgConfigRow>(
      'SELECT * FROM ranking_configs WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at ASC',
      [userId]
    );
    return rows.map(pgRowToConfig);
  }
  return [...store.configs.values()]
    .filter(c => c.userId === userId && c.isActive)
    .map(devRowToConfig);
}

export async function getConfigByCategoryId(userId: number, categoryId: string) {
  if (usePg()) {
    const rows = await query<PgConfigRow>(
      'SELECT * FROM ranking_configs WHERE user_id = $1 AND category_id = $2',
      [userId, categoryId]
    );
    return rows[0] ? pgRowToConfig(rows[0]) : null;
  }
  const row = [...store.configs.values()].find(
    c => c.userId === userId && c.categoryId === categoryId
  );
  return row ? devRowToConfig(row) : null;
}

export async function upsertConfig(
  userId: number,
  config: WeightConfig & { categoryName?: string }
) {
  if (usePg()) {
    const rows = await query<PgConfigRow>(
      `INSERT INTO ranking_configs (user_id, category_id, category_name, availability_threshold, criteria)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, category_id) DO UPDATE
         SET category_name = EXCLUDED.category_name,
             availability_threshold = EXCLUDED.availability_threshold,
             criteria = EXCLUDED.criteria, is_active = TRUE
       RETURNING *`,
      [userId, config.categoryId, config.categoryName ?? null,
       config.availabilityThreshold, JSON.stringify(config.criteria)]
    );
    return pgRowToConfig(rows[0]);
  }

  const existing = [...store.configs.values()].find(
    c => c.userId === userId && c.categoryId === config.categoryId
  );
  const now = new Date().toISOString();
  const id  = existing?.id ?? store.nextConfigId();
  const row: DevConfig = {
    id, userId,
    categoryId:            config.categoryId,
    categoryName:          config.categoryName,
    availabilityThreshold: config.availabilityThreshold,
    criteria:              config.criteria,
    isActive:              true,
    createdAt:             existing?.createdAt ?? now,
    updatedAt:             now,
  };
  store.configs.set(id, row);
  return devRowToConfig(row);
}

export async function deleteConfig(userId: number, categoryId: string): Promise<boolean> {
  if (usePg()) {
    const rows = await query<{ id: number }>(
      `UPDATE ranking_configs SET is_active = FALSE
       WHERE user_id = $1 AND category_id = $2 RETURNING id`,
      [userId, categoryId]
    );
    return rows.length > 0;
  }
  const row = [...store.configs.values()].find(
    c => c.userId === userId && c.categoryId === categoryId
  );
  if (!row) return false;
  store.configs.set(row.id, { ...row, isActive: false });
  return true;
}
