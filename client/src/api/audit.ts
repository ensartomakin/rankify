import { apiFetch } from './http';

export interface AuditLog {
  id: number;
  categoryId: string;
  triggeredBy: string;
  totalProducts: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  ranAt: string;
}

export async function fetchAuditLogs(categoryId?: string, limit = 30): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (categoryId) params.set('categoryId', categoryId);
  const res = await apiFetch(`/api/audit?${params}`);
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}
