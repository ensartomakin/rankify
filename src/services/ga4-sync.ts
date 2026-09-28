// GA4 metrics for ranking: which date range each GA4 criterion needs, keeping the
// cache fresh, and what happens when Google can't be reached.
//
// Rules (agreed):
//  - Credentials and synced metrics belong to the tenant's super admin (shared), so
//    every user's rankings read them from there.
//  - Every GA4 criterion uses its own "Veri Dönemi" (1d, 3d … 3m).
//  - Data older than `maxAgeMs` (12h; 6h before a scheduled run) is re-synced first.
//  - If syncing fails: data up to 7 days old is used with a warning; with no data or
//    older data the ranking stops with an error (the store keeps its current order).
import { getSuperAdminId } from '../db/user.repo';
import {
  getGa4Credentials, getGa4Metrics, upsertGa4Metrics, getGa4LastSyncByRange,
  type Ga4ProductMetric,
} from '../db/ga4.repo';
import { getActiveConfigsForTenant } from '../db/config.repo';
import { fetchGa4ProductMetrics } from './ga4-client';
import { logger } from '../utils/logger';
import type { WeightConfig, WeightCriterion } from '../types/product';

export const GA4_KEYS = new Set(['ga4Views', 'ga4CartAdds', 'ga4ConversionRate']);
export const GA4_TTL_MS           = 12 * 3600_000;
export const GA4_TTL_SCHEDULED_MS =  6 * 3600_000;
const GA4_MAX_STALE_MS            =  7 * 24 * 3600_000;
export const GA4_DEFAULT_RANGE    = '30d';

/** Criterion period → cached GA4 date range ("1m" → "30d", "1d" → "1d" …). */
export function ga4RangeFor(period?: string): string {
  switch (period) {
    case '1d': case '3d': case '7d': case '14d': case '21d': return period;
    case '1m': return '30d';
    case '2m': return '60d';
    case '3m': return '90d';
    default:   return GA4_DEFAULT_RANGE;
  }
}

export const isGa4Criterion = (c: WeightCriterion) => GA4_KEYS.has(c.key);

/** GA4 data belongs to the tenant's super admin (falls back to the user itself). */
export async function ga4OwnerId(userId: number, tenantId?: number): Promise<number> {
  return (await getSuperAdminId(tenantId).catch(() => null)) ?? userId;
}

/** Date ranges needed by the tenant's active category configs (default range if none). */
export async function usedGa4Ranges(tenantId?: number): Promise<string[]> {
  const configs = await getActiveConfigsForTenant(tenantId).catch(() => []);
  const ranges = new Set<string>();
  for (const c of configs) for (const k of c.criteria) if (isGa4Criterion(k)) ranges.add(ga4RangeFor(k.salesPeriod));
  return ranges.size > 0 ? [...ranges] : [GA4_DEFAULT_RANGE];
}

/** Categories (of the tenant) that use a GA4 criterion. */
export async function ga4UsingConfigs(tenantId?: number): Promise<{ categoryId: string; categoryName?: string }[]> {
  const configs = await getActiveConfigsForTenant(tenantId).catch(() => []);
  return configs
    .filter(c => c.criteria.some(isGa4Criterion))
    .map(c => ({ categoryId: c.categoryId, categoryName: c.categoryName }));
}

/** Fetches one range from Google and stores it. */
export async function syncGa4Range(ownerId: number, range: string): Promise<number> {
  const creds = await getGa4Credentials(ownerId);
  if (!creds) throw new Error('GA4 bağlı değil');
  if (!creds.propertyId) throw new Error('GA4 Property ID girilmemiş');
  const metrics = await fetchGa4ProductMetrics(creds.propertyId, creds.refreshToken, range);
  await upsertGa4Metrics(ownerId, metrics, range);
  logger.info(`[GA4] sync owner=${ownerId} ${range}: ${metrics.length} ürün`);
  return metrics.length;
}

/** Syncs every range the tenant's categories use (manual button and daily job). */
export async function syncUsedGa4Ranges(ownerId: number, tenantId?: number) {
  const out: { range: string; count: number; error?: string }[] = [];
  for (const range of await usedGa4Ranges(tenantId)) {
    try { out.push({ range, count: await syncGa4Range(ownerId, range) }); }
    catch (e) { out.push({ range, count: 0, error: e instanceof Error ? e.message : String(e) }); }
  }
  return out;
}

const RANGE_LABEL: Record<string, string> = { '1d': 'son 1 gün', '3d': 'son 3 gün', '7d': 'son 7 gün', '14d': 'son 14 gün', '21d': 'son 21 gün', '30d': 'son 30 gün', '60d': 'son 60 gün', '90d': 'son 90 gün' };
const hoursAgo = (d: Date) => Math.max(1, Math.round((Date.now() - d.getTime()) / 3600_000));

export interface Ga4Resolved {
  /** GA4 criterion key → (item id → metric) from that criterion's own date range. */
  byKey:    Map<string, Map<string, Ga4ProductMetric>>;
  warnings: string[];
}

/**
 * GA4 metrics a ranking needs. Throws when a GA4 criterion is configured but no usable
 * data can be obtained — the ranking must stop rather than silently score GA4 as 0.
 */
export async function resolveGa4ForRanking(
  config: WeightConfig,
  userId: number,
  tenantId: number | undefined,
  maxAgeMs = GA4_TTL_MS,
): Promise<Ga4Resolved> {
  const criteria = config.criteria.filter(isGa4Criterion);
  const byKey = new Map<string, Map<string, Ga4ProductMetric>>();
  const warnings: string[] = [];
  if (criteria.length === 0) return { byKey, warnings };

  const ownerId = await ga4OwnerId(userId, tenantId);
  const creds = await getGa4Credentials(ownerId).catch(() => null);
  if (!creds || !creds.propertyId) {
    throw new Error('GA4 bağlı değil — bu kategori GA4 kriteri kullanıyor (Ayarlar → Google Analytics 4)');
  }

  const lastByRange = await getGa4LastSyncByRange(ownerId).catch(() => ({} as Record<string, Date>));
  const perRange = new Map<string, Map<string, Ga4ProductMetric>>();
  for (const range of new Set(criteria.map(c => ga4RangeFor(c.salesPeriod)))) {
    const last = lastByRange[range];
    const fresh = last && Date.now() - last.getTime() <= maxAgeMs;
    if (!fresh) {
      try {
        await syncGa4Range(ownerId, range);
      } catch (e) {
        logger.warn(`[GA4] sync başarısız owner=${ownerId} ${range}: ${e}`);
        if (!last || Date.now() - last.getTime() > GA4_MAX_STALE_MS) {
          throw new Error(`GA4 verisi alınamadı (${RANGE_LABEL[range] ?? range}) — sıralama uygulanmadı, mağazadaki sıra korundu`);
        }
        warnings.push(`GA4 verisi (${RANGE_LABEL[range] ?? range}) güncellenemedi; ${hoursAgo(last)} saat önceki veri kullanıldı`);
      }
    }
    perRange.set(range, await getGa4Metrics(ownerId, range));
  }
  for (const c of criteria) byKey.set(c.key, perRange.get(ga4RangeFor(c.salesPeriod)) ?? new Map());
  return { byKey, warnings };
}
