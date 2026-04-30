import { apiFetch } from './http';

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  maxUsers: number;
  createdAt: string;
  userCount?: number;
}

export interface TenantUser {
  id: number;
  email: string;
  name?: string;
  role: 'super_admin' | 'user';
  tenantId: number;
}

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Hata: ${res.status}`);
  }
  return res.json();
}

// ── Tenants ─────────────────────────────────────────────────────────────────

export async function listTenants(): Promise<Tenant[]> {
  return handleRes(await apiFetch('/api/producer/tenants'));
}

export async function createTenant(data: { name: string; slug: string; maxUsers?: number }): Promise<Tenant> {
  return handleRes(await apiFetch('/api/producer/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  }));
}

export async function updateTenant(id: number, data: Partial<{ name: string; isActive: boolean; maxUsers: number }>): Promise<Tenant> {
  return handleRes(await apiFetch(`/api/producer/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }));
}

export async function deleteTenant(id: number): Promise<void> {
  await handleRes(await apiFetch(`/api/producer/tenants/${id}`, { method: 'DELETE' }));
}

// ── Tenant Users ─────────────────────────────────────────────────────────────

export async function listTenantUsers(tenantId: number): Promise<TenantUser[]> {
  return handleRes(await apiFetch(`/api/producer/tenants/${tenantId}/users`));
}

export async function createTenantUser(tenantId: number, data: { email: string; password: string; name?: string; role?: 'super_admin' | 'user' }): Promise<TenantUser> {
  return handleRes(await apiFetch(`/api/producer/tenants/${tenantId}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  }));
}

export async function deleteTenantUser(tenantId: number, userId: number): Promise<void> {
  await handleRes(await apiFetch(`/api/producer/tenants/${tenantId}/users/${userId}`, { method: 'DELETE' }));
}

// ── Impersonation ────────────────────────────────────────────────────────────

export async function impersonateTenant(tenantId: number): Promise<{
  token: string;
  user: TenantUser;
  impersonating: boolean;
  tenantName: string;
}> {
  return handleRes(await apiFetch(`/api/producer/tenants/${tenantId}/impersonate`, { method: 'POST' }));
}
