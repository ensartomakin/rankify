// Tüm API çağrıları bu fonksiyon üzerinden geçer — token otomatik eklenir
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token');
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}
