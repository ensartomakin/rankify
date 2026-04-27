import { query } from './client';
import { encrypt, decrypt } from '../utils/crypto';

export interface Ga4Credentials {
  propertyId: string;
  serviceAccountJson: string;
}

export interface Ga4ProductMetric {
  itemId: string;
  views: number;
  sessions: number;
  ctr: number;
  conversionRate: number;
  purchases: number;
  revenue: number;
}

interface CredRow {
  property_id: string;
  service_account_enc: string;
}

interface MetricRow {
  item_id: string;
  views: string;
  sessions: string;
  ctr: string;
  conversion_rate: string;
  purchases: string;
  revenue: string;
}

export async function upsertGa4Credentials(userId: number, creds: Ga4Credentials): Promise<void> {
  const enc = encrypt(creds.serviceAccountJson);
  await query(
    `INSERT INTO ga4_credentials (user_id, property_id, service_account_enc)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE
       SET property_id = EXCLUDED.property_id,
           service_account_enc = EXCLUDED.service_account_enc,
           updated_at = NOW()`,
    [userId, creds.propertyId, enc]
  );
}

export async function getGa4Credentials(userId: number): Promise<Ga4Credentials | null> {
  const rows = await query<CredRow>(
    'SELECT property_id, service_account_enc FROM ga4_credentials WHERE user_id = $1',
    [userId]
  );
  if (!rows[0]) return null;
  return {
    propertyId: rows[0].property_id,
    serviceAccountJson: decrypt(rows[0].service_account_enc),
  };
}

export async function hasGa4Credentials(userId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    'SELECT id FROM ga4_credentials WHERE user_id = $1',
    [userId]
  );
  return rows.length > 0;
}

export async function deleteGa4Credentials(userId: number): Promise<void> {
  await query('DELETE FROM ga4_credentials WHERE user_id = $1', [userId]);
  await query('DELETE FROM ga4_product_metrics WHERE user_id = $1', [userId]);
}

export async function upsertGa4Metrics(
  userId: number,
  metrics: Ga4ProductMetric[],
  dateRange: string
): Promise<void> {
  for (const m of metrics) {
    await query(
      `INSERT INTO ga4_product_metrics
         (user_id, item_id, date_range, views, sessions, ctr, conversion_rate, purchases, revenue, cached_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW())
       ON CONFLICT (user_id, item_id, date_range) DO UPDATE
         SET views = EXCLUDED.views, sessions = EXCLUDED.sessions,
             ctr = EXCLUDED.ctr, conversion_rate = EXCLUDED.conversion_rate,
             purchases = EXCLUDED.purchases, revenue = EXCLUDED.revenue,
             cached_at = NOW()`,
      [userId, m.itemId, dateRange, m.views, m.sessions, m.ctr, m.conversionRate, m.purchases, m.revenue]
    );
  }
}

export async function getGa4Metrics(
  userId: number,
  dateRange = '30d'
): Promise<Map<string, Ga4ProductMetric>> {
  const rows = await query<MetricRow>(
    `SELECT item_id, views, sessions, ctr, conversion_rate, purchases, revenue
     FROM ga4_product_metrics
     WHERE user_id = $1 AND date_range = $2`,
    [userId, dateRange]
  );
  return new Map(
    rows.map(r => [
      r.item_id,
      {
        itemId: r.item_id,
        views: Number(r.views),
        sessions: Number(r.sessions),
        ctr: Number(r.ctr),
        conversionRate: Number(r.conversion_rate),
        purchases: Number(r.purchases),
        revenue: Number(r.revenue),
      },
    ])
  );
}

export async function getGa4LastSync(userId: number): Promise<Date | null> {
  const rows = await query<{ cached_at: Date | null }>(
    'SELECT MAX(cached_at) as cached_at FROM ga4_product_metrics WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.cached_at ?? null;
}

export async function getGa4PropertyId(userId: number): Promise<string | null> {
  const rows = await query<{ property_id: string }>(
    'SELECT property_id FROM ga4_credentials WHERE user_id = $1',
    [userId]
  );
  return rows[0]?.property_id ?? null;
}
