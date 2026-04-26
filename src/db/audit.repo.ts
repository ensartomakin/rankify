import { store, type DevAuditLog } from './dev-store';
import { query } from './client';

export interface AuditEntry {
  userId: number;
  categoryId: string;
  triggeredBy: 'cron' | 'manual';
  totalProducts: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

interface PgAuditRow {
  id: number; user_id: number; category_id: string; triggered_by: string;
  total_products: number; qualified_count: number; disqualified_count: number;
  duration_ms: number; status: string; error_message: string | null; ran_at: string;
}

function pgRowToLog(r: PgAuditRow) {
  return {
    id: r.id, categoryId: r.category_id, triggeredBy: r.triggered_by,
    totalProducts: r.total_products, qualifiedCount: r.qualified_count,
    disqualifiedCount: r.disqualified_count, durationMs: r.duration_ms,
    status: r.status as 'success' | 'error',
    errorMessage: r.error_message ?? undefined, ranAt: r.ran_at,
  };
}

function devRowToLog(r: DevAuditLog) {
  return {
    id: r.id, categoryId: r.categoryId, triggeredBy: r.triggeredBy,
    totalProducts: r.totalProducts, qualifiedCount: r.qualifiedCount,
    disqualifiedCount: r.disqualifiedCount, durationMs: r.durationMs,
    status: r.status as 'success' | 'error',
    errorMessage: r.errorMessage, ranAt: r.ranAt,
  };
}

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function insertAuditLog(entry: AuditEntry): Promise<void> {
  if (usePg()) {
    await query(
      `INSERT INTO audit_logs
         (user_id, category_id, triggered_by, total_products, qualified_count,
          disqualified_count, duration_ms, status, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [entry.userId, entry.categoryId, entry.triggeredBy, entry.totalProducts,
       entry.qualifiedCount, entry.disqualifiedCount, entry.durationMs,
       entry.status, entry.errorMessage ?? null]
    );
    return;
  }
  const id = store.nextAuditId();
  store.audits.set(id, {
    id, userId: entry.userId, categoryId: entry.categoryId,
    triggeredBy: entry.triggeredBy, totalProducts: entry.totalProducts,
    qualifiedCount: entry.qualifiedCount, disqualifiedCount: entry.disqualifiedCount,
    durationMs: entry.durationMs, status: entry.status,
    errorMessage: entry.errorMessage, ranAt: new Date().toISOString(),
  });
}

export async function getAuditLogs(userId: number, categoryId?: string, limit = 30) {
  if (usePg()) {
    const rows = categoryId
      ? await query<PgAuditRow>(
          `SELECT * FROM audit_logs WHERE user_id=$1 AND category_id=$2 ORDER BY ran_at DESC LIMIT $3`,
          [userId, categoryId, limit])
      : await query<PgAuditRow>(
          'SELECT * FROM audit_logs WHERE user_id=$1 ORDER BY ran_at DESC LIMIT $2',
          [userId, limit]);
    return rows.map(pgRowToLog);
  }

  return [...store.audits.values()]
    .filter(r => r.userId === userId && (!categoryId || r.categoryId === categoryId))
    .sort((a, b) => b.ranAt.localeCompare(a.ranAt))
    .slice(0, limit)
    .map(devRowToLog);
}
