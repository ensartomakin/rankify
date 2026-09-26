import { query } from './client';
import { encrypt, decrypt } from '../utils/crypto';
import { store } from './dev-store';
import type { FieldMapping } from '../types/field-mapping';

export interface TsoftCredentials {
  apiUrl:    string;
  storeCode: string;
  apiUser:   string;
  apiPass:   string;
  apiToken?: string; // V3 Bearer token — 2FA olmadan direkt kullanılır
  fieldMapping?: FieldMapping; // ürün alanı eşlemesi (sezon vb.)
}

interface CredRow {
  id: number; user_id: number;
  api_url: string; store_code: string; api_user: string; api_pass_enc: string; api_token_enc?: string;
  field_mapping?: FieldMapping | null;
}

const usePg = () => Boolean(process.env.DATABASE_URL);

export async function upsertCredentials(userId: number, creds: TsoftCredentials): Promise<void> {
  const encPass  = encrypt(creds.apiPass);
  const encToken = creds.apiToken ? encrypt(creds.apiToken) : null;

  if (usePg()) {
    await query(
      `INSERT INTO tsoft_credentials (user_id, api_url, store_code, api_user, api_pass_enc, api_token_enc)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE
         SET api_url = EXCLUDED.api_url, store_code = EXCLUDED.store_code,
             api_user = EXCLUDED.api_user, api_pass_enc = EXCLUDED.api_pass_enc,
             api_token_enc = EXCLUDED.api_token_enc`,
      [userId, creds.apiUrl, creds.storeCode, creds.apiUser, encPass, encToken]
    );
    return;
  }
  const prev = store.credentials.get(userId);
  store.credentials.set(userId, { ...creds, apiPassEnc: encPass, apiToken: creds.apiToken, fieldMapping: prev?.fieldMapping });
}

export async function getCredentials(userId: number): Promise<TsoftCredentials | null> {
  if (usePg()) {
    const rows = await query<CredRow>(
      'SELECT * FROM tsoft_credentials WHERE user_id = $1', [userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    try {
      return {
        apiUrl:    r.api_url,
        storeCode: r.store_code,
        apiUser:   r.api_user,
        apiPass:   decrypt(r.api_pass_enc),
        apiToken:  r.api_token_enc ? decrypt(r.api_token_enc) : undefined,
        fieldMapping: r.field_mapping ?? undefined,
      };
    } catch {
      // Corrupted ciphertext — treat as missing (user must re-enter credentials)
      return null;
    }
  }

  const row = store.credentials.get(userId);
  if (!row) return null;
  try {
    return { apiUrl: row.apiUrl, storeCode: row.storeCode, apiUser: row.apiUser, apiPass: decrypt(row.apiPassEnc), apiToken: row.apiToken, fieldMapping: row.fieldMapping };
  } catch {
    return null;
  }
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

/** Field mapping is stored beside the credentials but written separately, so
 *  saving credentials never resets it. */
export async function setFieldMapping(userId: number, mapping: FieldMapping): Promise<void> {
  if (usePg()) {
    await query('UPDATE tsoft_credentials SET field_mapping = $2 WHERE user_id = $1', [userId, JSON.stringify(mapping)]);
    return;
  }
  const row = store.credentials.get(userId);
  if (row) store.credentials.set(userId, { ...row, fieldMapping: mapping });
}
