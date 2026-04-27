import { apiFetch } from './http';

export interface Ga4Status {
  configured:  boolean;
  ready:       boolean;       // configured + propertyId set
  propertyId:  string | null;
  googleEmail: string | null;
  lastSync:    string | null;
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

export async function fetchGa4AuthUrl(): Promise<string> {
  const res = await apiFetch('/api/ga4/auth/url');
  if (!res.ok) throw new Error('OAuth URL alınamadı');
  const { url } = await res.json();
  return url;
}

export async function saveGa4PropertyId(propertyId: string): Promise<void> {
  const res = await apiFetch('/api/ga4/property', {
    method: 'PUT',
    body:   JSON.stringify({ propertyId }),
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

export async function testGa4Connection(): Promise<{ ok: boolean; message: string }> {
  const res = await apiFetch('/api/ga4/test', { method: 'POST' });
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

/** Popup aç, OAuth tamamlanınca resolve eder */
export function openGa4OAuthPopup(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = 600, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top  = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(authUrl, 'ga4_oauth', `width=${w},height=${h},left=${left},top=${top}`);

    if (!popup) { reject(new Error('Popup engellendi — tarayıcı popup iznini kontrol edin')); return; }

    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'ga4_oauth') return;
      window.removeEventListener('message', onMessage);
      if (e.data.status === 'success') resolve(e.data.detail as string);
      else reject(new Error(e.data.detail ?? 'OAuth hatası'));
    }
    window.addEventListener('message', onMessage);

    // Popup kapatılırsa timeout
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error('Popup kapatıldı'));
      }
    }, 500);
  });
}
