import { store } from './dev-store';
import { query } from './client';

export type UserRole = 'super_admin' | 'user';

export interface User {
  id: number;
  email: string;
  name?: string;
  role: UserRole;
}

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string,
  role: UserRole = 'user'
): Promise<User> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null; role: string }>(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role`,
      [email, passwordHash, name ?? null, role]
    );
    const r = rows[0];
    return { id: r.id, email: r.email, name: r.name ?? undefined, role: r.role as UserRole };
  }

  const id = store.nextUserId();
  store.users.set(id, { id, email, passwordHash, name, role });
  return { id, email, name, role };
}

export async function findUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null; password_hash: string; role: string }>(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, email: r.email, name: r.name ?? undefined, passwordHash: r.password_hash, role: r.role as UserRole };
  }

  const user = [...store.users.values()].find(u => u.email === email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, passwordHash: user.passwordHash, role: user.role };
}

export async function findUserById(id: number): Promise<User | null> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null; role: string }>(
      'SELECT id, email, name, role FROM users WHERE id = $1', [id]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, email: r.email, name: r.name ?? undefined, role: r.role as UserRole };
  }

  const user = store.users.get(id);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function listUsers(): Promise<User[]> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null; role: string }>(
      'SELECT id, email, name, role FROM users ORDER BY id'
    );
    return rows.map(r => ({ id: r.id, email: r.email, name: r.name ?? undefined, role: r.role as UserRole }));
  }

  return [...store.users.values()].map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
}

export async function countUsers(): Promise<number> {
  if (usePg()) {
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

export async function getSuperAdminId(): Promise<number | null> {
  if (usePg()) {
    const rows = await query<{ id: number }>(
      'SELECT id FROM users WHERE role = $1 ORDER BY id LIMIT 1',
      ['super_admin']
    );
    return rows[0]?.id ?? null;
  }

  const superAdmin = [...store.users.values()].find(u => u.role === 'super_admin');
  return superAdmin?.id ?? null;
}
