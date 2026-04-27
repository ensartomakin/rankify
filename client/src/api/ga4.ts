import { apiFetch } from './http';

export interface Ga4Status {
  configured: boolean;
  propertyId: string | null;
  lastSync:   string | null;
}

export interface Ga4Credentials {
  propertyId:         string;
  serviceAccountJson: string;
}

export interface Ga4ProductMetric {
  itemId:         string;
  views:          number;
  sessions:       number;
  ctr:            number;
  conversionRate: number;
  purchases:      number;
  revenue:        number;
}

export async function fetchGa4Status(): Promise<Ga4Status> {
  const res = await apiFetch('/api/ga4/status');
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}

export async function saveGa4Credentials(payload: Ga4Credentials): Promise<void> {
  const res = await apiFetch('/api/ga4/credentials', {
    method: 'PUT',
    body:   JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
}

export async function deleteGa4Credentials(): Promise<void> {
  const res = await apiFetch('/api/ga4/credentials', { method: 'DELETE' });
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
}

export async function testGa4Credentials(
  payload: Ga4Credentials
): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch('/api/ga4/test', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });
  return res.json();
}

export async function syncGa4Metrics(dateRange = '30d'): Promise<{ count: number }> {
  const res = await apiFetch(`/api/ga4/sync?dateRange=${dateRange}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}

export async function fetchGa4Metrics(dateRange = '30d'): Promise<Record<string, Ga4ProductMetric>> {
  const res = await apiFetch(`/api/ga4/metrics?dateRange=${dateRange}`);
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}
