import { apiFetch } from './http';

export interface CredentialsPayload {
  apiUrl:    string;
  storeCode: string;
  apiUser:   string;
  apiPass:   string;
  apiToken?: string;
}

export interface CredentialsSummary extends Omit<CredentialsPayload, 'apiPass'> {
  configured: boolean;
  apiPass: string; // '••••••••' veya gerçek değer (sadece formda)
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
    throw new Error(err?.error?.formErrors?.[0] ?? `Hata: ${res.status}`);
  }
}

export async function testCredentials(
  payload: CredentialsPayload
): Promise<{ ok: boolean; message: string; debug?: string }> {
  const res = await apiFetch('/api/settings/credentials/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export interface ScheduleSettings {
  isEnabled: boolean;
  dayHours:  Record<number, number[]>;  // gün (0-6) → saat listesi (0-23)
}

export async function fetchSchedule(): Promise<ScheduleSettings> {
  const res = await apiFetch('/api/settings/schedule');
  if (!res.ok) throw new Error(`Hata: ${res.status}`);
  return res.json();
}

export async function saveSchedule(payload: ScheduleSettings): Promise<void> {
  const res = await apiFetch('/api/settings/schedule', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.formErrors?.[0] ?? `Hata: ${res.status}`);
  }
}
