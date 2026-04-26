import { apiFetch } from './http';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}
