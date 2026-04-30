import { apiFetch } from './http';

export type UserRole = 'producer' | 'super_admin' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  role: UserRole;
  tenantId?: number;
}

export interface AuthResponse {
  token?: string;
  user: AuthUser;
}

export async function getSetupStatus(): Promise<{ needsSetup: boolean }> {
  const res = await apiFetch('/api/auth/setup');
  if (!res.ok) return { needsSetup: false };
  return res.json();
}

export async function register(email: string, password: string, name?: string, producerSecret?: string): Promise<AuthResponse> {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, producerSecret }),
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
