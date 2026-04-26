import { store } from './dev-store';
import { query } from './client';

export interface User {
  id: number;
  email: string;
  name?: string;
}

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function createUser(email: string, passwordHash: string, name?: string): Promise<User> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null }>(
      `INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name`,
      [email, passwordHash, name ?? null]
    );
    const r = rows[0];
    return { id: r.id, email: r.email, name: r.name ?? undefined };
  }

  const id = store.nextUserId();
  store.users.set(id, { id, email, passwordHash, name });
  return { id, email, name };
}

export async function findUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  if (usePg()) {
    const rows = await query<{ id: number; email: string; name: string | null; password_hash: string }>(
      'SELECT * FROM users WHERE email = $1', [email]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, email: r.email, name: r.name ?? undefined, passwordHash: r.password_hash };
  }

  const user = [...store.users.values()].find(u => u.email === email);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, passwordHash: user.passwordHash };
}
