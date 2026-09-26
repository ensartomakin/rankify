import { apiFetch } from './http';

export interface CredentialsPayload {
  apiUrl:    string;
  storeCode: string;
  apiUser:   string;
  apiPass:   string;
  apiToken?: string;
}

export interface CredentialsSummary extends Omit<CredentialsPayload, 'apiPass' | 'apiToken'> {
  configured: boolean;
  storeName?: string;  // connected store's domain, for display
  apiPass: string;   // '••••••••' (sunucu her zaman maskeler)
  apiToken: string;  // '••••••••' ayarlıysa, '' ayarlanmamışsa
}

export async function fetchCredentials(): Promise<CredentialsSummary> {
  const res = await apiFetch('/api/settings/credentials');
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}

export async function saveCredentials(payload: CredentialsPayload): Promise<void> {
  const res = await apiFetch('/api/settings/credentials', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 403) throw new Error('Bu işlem için süper admin yetkisi gerekli');
    throw new Error(err?.error?.formErrors?.[0] ?? err?.error ?? `Hata: ${res.status}`);
  }
}

export async function testCredentials(
  payload: CredentialsPayload
): Promise<{ ok: boolean; message: string; debug?: string }> {
  const res = await apiFetch('/api/settings/credentials/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !('ok' in data)) {
    if (res.status === 403) throw new Error('Bu işlem için süper admin yetkisi gerekli');
    throw new Error(data?.error ?? `Hata: ${res.status}`);
  }
  return data;
}

/* ── Eski hesap geneli zamanlama: geçiş bildirimi ──────────────────────
   Zamanlama artık kategori bazlı (kayıtlı kategori ayarlarıyla birlikte). */
export async function fetchLegacyScheduleNotice(): Promise<boolean> {
  const res = await apiFetch('/api/settings/legacy-schedule-notice');
  if (!res.ok) return false;   // older API: no notice
  const data = await res.json().catch(() => ({}));
  return Boolean(data?.pending);
}

export async function dismissLegacyScheduleNotice(): Promise<void> {
  await apiFetch('/api/settings/legacy-schedule-notice', { method: 'DELETE' }).catch(() => {});
}

/* ── Ürün alanı eşlemesi ─────────────────────────────────────────────── */
export interface FieldOption { id: string; label: string }
export interface FieldMappingInfo {
  configured: boolean;
  mapping: { season: string };
  options: { season: FieldOption[] };   // labels come from the connected platform
}

export async function fetchFieldMapping(): Promise<FieldMappingInfo> {
  const res = await apiFetch('/api/settings/field-mapping');
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}

export async function saveFieldMapping(mapping: { season: string }): Promise<void> {
  const res = await apiFetch('/api/settings/field-mapping', { method: 'PUT', body: JSON.stringify(mapping) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === 'string' ? err.error : `Hata: ${res.status}`);
  }
}
