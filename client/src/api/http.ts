// Tüm API çağrıları bu fonksiyon üzerinden geçer — httpOnly cookie otomatik gönderilir
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: 'include', // httpOnly cookie'yi gönderir
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}
