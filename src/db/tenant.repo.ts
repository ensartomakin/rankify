import { query } from './client';

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  maxUsers: number;
  createdAt: string;
}

type TenantRow = {
  id: number; name: string; slug: string;
  is_active: boolean; max_users: number; created_at: string;
};

function mapTenant(r: TenantRow): Tenant {
  return { id: r.id, name: r.name, slug: r.slug, isActive: r.is_active, maxUsers: r.max_users, createdAt: r.created_at };
}

export async function createTenant(name: string, slug: string, maxUsers = 5): Promise<Tenant> {
  const rows = await query<TenantRow>(
    `INSERT INTO tenants (name, slug, max_users)
     VALUES ($1, $2, $3)
     RETURNING id, name, slug, is_active, max_users, created_at`,
    [name, slug, maxUsers]
  );
  return mapTenant(rows[0]);
}

export async function listTenants(): Promise<(Tenant & { userCount: number })[]> {
  const rows = await query<TenantRow & { user_count: string }>(
    `SELECT t.id, t.name, t.slug, t.is_active, t.max_users, t.created_at,
            COUNT(u.id) FILTER (WHERE u.role <> 'producer') AS user_count
     FROM tenants t
     LEFT JOIN users u ON u.tenant_id = t.id
     GROUP BY t.id
     ORDER BY t.created_at DESC`
  );
  return rows.map(r => ({ ...mapTenant(r), userCount: parseInt(r.user_count ?? '0', 10) }));
}

export async function getTenantById(id: number): Promise<Tenant | null> {
  const rows = await query<TenantRow>(
    `SELECT id, name, slug, is_active, max_users, created_at FROM tenants WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapTenant(rows[0]) : null;
}

export async function updateTenant(
  id: number,
  updates: Partial<{ name: string; isActive: boolean; maxUsers: number }>
): Promise<Tenant | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (updates.name      !== undefined) { sets.push(`name = $${i++}`);      vals.push(updates.name); }
  if (updates.isActive  !== undefined) { sets.push(`is_active = $${i++}`); vals.push(updates.isActive); }
  if (updates.maxUsers  !== undefined) { sets.push(`max_users = $${i++}`); vals.push(updates.maxUsers); }
  if (!sets.length) return getTenantById(id);
  vals.push(id);
  const rows = await query<TenantRow>(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, name, slug, is_active, max_users, created_at`,
    vals
  );
  return rows[0] ? mapTenant(rows[0]) : null;
}

export async function deleteTenant(id: number): Promise<void> {
  await query('DELETE FROM tenants WHERE id = $1', [id]);
}

export async function getTenantUserCount(tenantId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users WHERE tenant_id = $1 AND role <> 'producer'`,
    [tenantId]
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}
