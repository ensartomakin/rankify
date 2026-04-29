import { randomBytes } from 'crypto';

interface NonceEntry { userId: number; expiresAt: number; }

const store = new Map<string, NonceEntry>();
const TTL_MS = 10 * 60 * 1000; // 10 dakika

export function createNonce(userId: number): string {
  const nonce = randomBytes(32).toString('hex');
  store.set(nonce, { userId, expiresAt: Date.now() + TTL_MS });
  // expired entry cleanup
  for (const [key, val] of store) {
    if (val.expiresAt < Date.now()) store.delete(key);
  }
  return nonce;
}

// Single-use: deletes the nonce on first call
export function consumeNonce(nonce: string): number | null {
  const entry = store.get(nonce);
  store.delete(nonce);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.userId;
}
