import { store, type DevConfig } from './dev-store';
import { query } from './client';
import type { WeightConfig, WeightCriterion, SeasonPreFilter } from '../types/product';

const usePg = () => Boolean(process.env.DATABASE_URL);

/** Per-category automatic run: on these days (0=Sun … 6=Sat) at these hours (Europe/Istanbul). */
export interface CategorySchedule {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;
}
const NO_SCHEDULE: CategorySchedule = { isEnabled: false, dayHours: {} };

function toDayHours(raw: Record<string, number[]> | undefined | null): Record<number, number[]> {
  const out: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(raw ?? {})) out[Number(k)] = v;
  return out;
}

/** Fields saved with a category besides threshold and criteria. Omitted ones keep their stored value. */
export interface ConfigExtras {
  smartMix?:        boolean;
  seasonPreFilter?: SeasonPreFilter;
  schedule?:        CategorySchedule;
}

function devRowToConfig(row: DevConfig) {
  return {
    id:                    row.id,
    userId:                row.userId,
    categoryId:            row.categoryId,
    categoryName:          row.categoryName,
    availabilityThreshold: row.availabilityThreshold,
    criteria:              row.criteria as WeightConfig['criteria'],
    isActive:              row.isActive,
    smartMix:              row.smartMix ?? true,
    seasonPreFilter:       (row.seasonPreFilter ?? 'none') as SeasonPreFilter,
    schedule:              row.schedule ?? { ...NO_SCHEDULE },
  };
}

interface PgConfigRow {
  id: number; user_id: number; category_id: string; category_name: string | null;
  availability_threshold: string; criteria: WeightCriterion[]; is_active: boolean;
  smart_mix: boolean; season_pre_filter: string;
  schedule_enabled: boolean; schedule_day_hours: Record<string, number[]>;
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
    smartMix:              r.smart_mix,
    seasonPreFilter:       r.season_pre_filter as SeasonPreFilter,
    schedule:              { isEnabled: r.schedule_enabled, dayHours: toDayHours(r.schedule_day_hours) },
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

/** Active categories whose schedule is on, with the owner's tenant — for the scheduler. */
export async function getScheduledConfigs() {
  if (usePg()) {
    const rows = await query<PgConfigRow & { tenant_id: number | null }>(
      `SELECT rc.*, u.tenant_id
       FROM ranking_configs rc
       JOIN users u ON u.id = rc.user_id
       WHERE rc.is_active = TRUE AND rc.schedule_enabled = TRUE
       ORDER BY rc.created_at ASC`
    );
    return rows.map(r => ({ ...pgRowToConfig(r), tenantId: r.tenant_id ?? undefined }));
  }
  return [...store.configs.values()]
    .filter(c => c.isActive && c.schedule?.isEnabled)
    .map(c => ({ ...devRowToConfig(c), tenantId: undefined as number | undefined }));
}

export async function upsertConfig(
  userId: number,
  config: WeightConfig & { categoryName?: string } & ConfigExtras
) {
  if (usePg()) {
    // NULL extras (older clients) keep the stored value on update, defaults on insert.
    const rows = await query<PgConfigRow>(
      `INSERT INTO ranking_configs (user_id, category_id, category_name, availability_threshold, criteria,
                                    smart_mix, season_pre_filter, schedule_enabled, schedule_day_hours)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6, TRUE), COALESCE($7, 'none'), COALESCE($8, FALSE), COALESCE($9::jsonb, '{}'::jsonb))
       ON CONFLICT (user_id, category_id) DO UPDATE
         SET category_name = EXCLUDED.category_name,
             availability_threshold = EXCLUDED.availability_threshold,
             criteria = EXCLUDED.criteria, is_active = TRUE,
             smart_mix          = COALESCE($6, ranking_configs.smart_mix),
             season_pre_filter  = COALESCE($7, ranking_configs.season_pre_filter),
             schedule_enabled   = COALESCE($8, ranking_configs.schedule_enabled),
             schedule_day_hours = COALESCE($9::jsonb, ranking_configs.schedule_day_hours)
       RETURNING *`,
      [userId, config.categoryId, config.categoryName ?? null,
       config.availabilityThreshold, JSON.stringify(config.criteria),
       config.smartMix ?? null, config.seasonPreFilter ?? null,
       config.schedule ? config.schedule.isEnabled : null,
       config.schedule ? JSON.stringify(config.schedule.dayHours) : null]
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
    smartMix:              config.smartMix ?? existing?.smartMix ?? true,
    seasonPreFilter:       config.seasonPreFilter ?? existing?.seasonPreFilter ?? 'none',
    schedule:              config.schedule ?? existing?.schedule ?? { ...NO_SCHEDULE },
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
