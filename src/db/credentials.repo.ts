import { query } from './client';
import { encrypt, decrypt } from '../utils/crypto';
import { store } from './dev-store';

export interface TsoftCredentials {
  apiUrl:    string;
  storeCode: string;
  apiUser:   string;
  apiPass:   string;
  apiToken?: string; // V3 Bearer token — 2FA olmadan direkt kullanılır
}

interface CredRow {
  id: number; user_id: number;
  api_url: string; store_code: string; api_user: string; api_pass_enc: string; api_token?: string;
}

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function upsertCredentials(userId: number, creds: TsoftCredentials): Promise<void> {
  const enc = encrypt(creds.apiPass);

  if (usePg()) {
    await query(
      `INSERT INTO tsoft_credentials (user_id, api_url, store_code, api_user, api_pass_enc, api_token)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE
         SET api_url = EXCLUDED.api_url, store_code = EXCLUDED.store_code,
             api_user = EXCLUDED.api_user, api_pass_enc = EXCLUDED.api_pass_enc,
             api_token = EXCLUDED.api_token`,
      [userId, creds.apiUrl, creds.storeCode, creds.apiUser, enc, creds.apiToken ?? null]
    );
    return;
  }
  store.credentials.set(userId, { ...creds, apiPassEnc: enc, apiToken: creds.apiToken });
}

export async function getCredentials(userId: number): Promise<TsoftCredentials | null> {
  if (usePg()) {
    const rows = await query<CredRow>(
      'SELECT * FROM tsoft_credentials WHERE user_id = $1', [userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return { apiUrl: r.api_url, storeCode: r.store_code, apiUser: r.api_user, apiPass: decrypt(r.api_pass_enc), apiToken: r.api_token ?? undefined };
  }

  const row = store.credentials.get(userId);
  if (!row) {
    // .env'de dev credential varsa bu kullanıcıya otomatik yükle
    const { DEV_API_URL, DEV_STORE_CODE, DEV_API_USER, DEV_API_PASS } = process.env;
    if (DEV_API_URL && DEV_STORE_CODE && DEV_API_USER && DEV_API_PASS) {
      await upsertCredentials(userId, {
        apiUrl: DEV_API_URL, storeCode: DEV_STORE_CODE,
        apiUser: DEV_API_USER, apiPass: DEV_API_PASS,
        apiToken: process.env.DEV_API_TOKEN || undefined,
      });
      return getCredentials(userId);
    }
    return null;
  }
  return { apiUrl: row.apiUrl, storeCode: row.storeCode, apiUser: row.apiUser, apiPass: decrypt(row.apiPassEnc), apiToken: row.apiToken };
}

export async function hasCredentials(userId: number): Promise<boolean> {
  if (usePg()) {
    const rows = await query<{ id: number }>(
      'SELECT id FROM tsoft_credentials WHERE user_id = $1', [userId]
    );
    return rows.length > 0;
  }
  return store.credentials.has(userId);
}
