import { store } from './dev-store';
import { query } from './client';

export type UserRole = 'producer' | 'super_admin' | 'user';

export interface User {
  id: number;
  email: string;
  name?: string;
  role: UserRole;
  tenantId?: number;
}

const usePg = () => Boolean(process.env.DATABASE_URL);

type UserRow = { id: number; email: string; name: string | null; role: string; tenant_id: number | null };

function mapUser(r: UserRow): User {
  return { id: r.id, email: r.email, name: r.name ?? undefined, role: r.role as UserRole, tenantId: r.tenant_id ?? undefined };
}

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string,
  role: UserRole = 'user',
  tenantId?: number
): Promise<User> {
  if (usePg()) {
    const rows = await query<UserRow>(
      `INSERT INTO users (email, password_hash, name, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, name, role, tenant_id`,
      [email, passwordHash, name ?? null, role, tenantId ?? null]
    );
    return mapUser(rows[0]);
  }

  const id = store.nextUserId();
  store.users.set(id, { id, email, passwordHash, name, role });
  return { id, email, name, role };
}

export async function findUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  if (usePg()) {
    const rows = await query<UserRow & { password_hash: string }>(
      'SELECT id, email, name, role, tenant_id, password_hash FROM users WHERE email = $1',
      [email]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { ...mapUser(r), passwordHash: r.password_hash };
  }

  const user = [...store.users.values()].find(u => u.email === email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, passwordHash: user.passwordHash, role: user.role };
}

export async function findUserById(id: number): Promise<User | null> {
  if (usePg()) {
    const rows = await query<UserRow>(
      'SELECT id, email, name, role, tenant_id FROM users WHERE id = $1',
      [id]
    );
    if (!rows[0]) return null;
    return mapUser(rows[0]);
  }

  const user = store.users.get(id);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function listUsers(tenantId?: number): Promise<User[]> {
  if (usePg()) {
    if (tenantId !== undefined) {
      const rows = await query<UserRow>(
        'SELECT id, email, name, role, tenant_id FROM users WHERE tenant_id = $1 ORDER BY id',
        [tenantId]
      );
      return rows.map(mapUser);
    }
    const rows = await query<UserRow>(
      'SELECT id, email, name, role, tenant_id FROM users ORDER BY id'
    );
    return rows.map(mapUser);
  }

  return [...store.users.values()].map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
}

export async function countUsers(tenantId?: number): Promise<number> {
  if (usePg()) {
    if (tenantId !== undefined) {
      const rows = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1',
        [tenantId]
      );
      return parseInt(rows[0].count, 10);
    }
    const rows = await query<{ count: string }>('SELECT COUNT(*) as count FROM users');
    return parseInt(rows[0].count, 10);
  }
  return store.users.size;
}

export async function deleteUser(id: number): Promise<void> {
  if (usePg()) {
    await query('DELETE FROM users WHERE id = $1', [id]);
    return;
  }
  store.users.delete(id);
}

export async function getSuperAdminId(tenantId?: number): Promise<number | null> {
  if (usePg()) {
    if (tenantId !== undefined) {
      const rows = await query<{ id: number }>(
        'SELECT id FROM users WHERE role = $1 AND tenant_id = $2 ORDER BY id LIMIT 1',
        ['super_admin', tenantId]
      );
      return rows[0]?.id ?? null;
    }
    const rows = await query<{ id: number }>(
      'SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1',
      ['super_admin']
    );
    return rows[0]?.id ?? null;
  }

  const superAdmin = [...store.users.values()].find(u => u.role === 'super_admin');
  return superAdmin?.id ?? null;
}

export async function producerExists(): Promise<boolean> {
  if (usePg()) {
    const rows = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'producer'"
    );
    return parseInt(rows[0].count, 10) > 0;
  }
  return [...store.users.values()].some(u => u.role === 'producer');
}
