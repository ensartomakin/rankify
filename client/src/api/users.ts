import { apiFetch } from './http';
import type { UserRole } from './auth';

export interface UserItem {
  id: number;
  email: string;
  name?: string;
  role: UserRole;
}

export async function listUsers(): Promise<UserItem[]> {
  const res = await apiFetch('/api/users');
  if (!res.ok) throw new Error('Kullanıcılar alınamadı');
  return res.json();
}

export async function createUser(email: string, password: string, name?: string): Promise<UserItem> {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}

export async function deleteUser(id: number): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
}
