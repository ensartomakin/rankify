import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// ENCRYPTION_KEY env'den türetilir; dev'de JWT_SECRET kullanılır
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'dev-secret';
  return scryptSync(secret, 'rankify-salt', 32);
}

export function encrypt(plaintext: string): string {
  const iv         = randomBytes(12);
  const cipher     = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  // iv(12) + authTag(16) + ciphertext → base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encoded: string): string {
  const buf      = Buffer.from(encoded, 'base64');
  const iv       = buf.subarray(0, 12);
  const authTag  = buf.subarray(12, 28);
  const payload  = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(payload) + decipher.final('utf8');
}
