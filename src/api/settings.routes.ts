import { Router, Request, Response } from 'express';
import { promises as dns } from 'dns';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { upsertCredentials, getCredentials, hasCredentials } from '../db/credentials.repo';
import { getSchedule, setSchedule } from '../db/schedule.repo';
import { testConnection } from '../services/tsoft-client';
import { getSuperAdminId } from '../db/user.repo';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

// Blocks private/loopback IPs — applied after DNS resolution to prevent IPv6/encoded bypasses
const PRIVATE_CIDR = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0$)/;

async function validateSsrfSafeUrl(raw: string): Promise<void> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Geçersiz URL formatı'); }
  if (u.protocol !== 'https:') throw new Error('Yalnızca HTTPS URL kabul edilir');

  // Resolve to actual IPs to catch IDN, decimal/octal/hex encodings, and DNS rebinding attempts
  let resolved: string[];
  try {
    resolved = await dns.resolve4(u.hostname);
  } catch {
    // hostname may be an IP literal or unresolvable; check the raw hostname
    resolved = [u.hostname];
  }
  for (const ip of resolved) {
    if (PRIVATE_CIDR.test(ip)) throw new Error('Özel veya yerel IP adreslerine bağlantı yasak');
  }
}

const credsSchema = z.object({
  apiUrl:    z.string().url('Geçerli bir URL girin'),
  storeCode: z.string().min(1),
  apiUser:   z.string().min(1),
  apiPass:   z.string().min(1),
  apiToken:  z.string().optional(),
});

const testSchema = z.object({
  apiUrl:    z.string().url('Geçerli bir URL girin'),
  storeCode: z.string().min(1),
  apiUser:   z.string().min(1),
  apiPass:   z.string().optional(),
  apiToken:  z.string().optional(),
});

// Credentials her zaman super_admin'in hesabından okunur (paylaşımlı)
async function getCredentialsOwnerId(requestingUserId: number): Promise<number> {
  const superAdminId = await getSuperAdminId();
  return superAdminId ?? requestingUserId;
}

// GET — super_admin tam özet alır; diğer roller sadece configured:boolean
settingsRouter.get('/credentials', async (req: Request, res: Response) => {
  const ownerId = await getCredentialsOwnerId(req.user!.userId);
  const configured = await hasCredentials(ownerId);

  if (req.user!.role !== 'super_admin') {
    res.json({ configured }); return;
  }

  if (!configured) { res.json({ configured: false }); return; }
  const creds = await getCredentials(ownerId);
  if (!creds) { res.json({ configured: false }); return; }

  res.json({
    configured: true,
    apiUrl:    creds.apiUrl,
    storeCode: creds.storeCode,
    apiUser:   creds.apiUser,
    apiPass:   '••••••••',
  });
});

// PUT — sadece super_admin kaydedebilir
settingsRouter.put('/credentials', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try { await validateSsrfSafeUrl(parsed.data.apiUrl); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Geçersiz URL' }); return; }

  await upsertCredentials(req.user!.userId, parsed.data);
  res.json({ message: 'Bağlantı bilgileri kaydedildi' });
});

// GET — zamanlama ayarları (kullanıcıya özel)
settingsRouter.get('/schedule', async (req: Request, res: Response) => {
  const schedule = await getSchedule(req.user!.userId);
  res.json(schedule);
});

const scheduleSchema = z.object({
  isEnabled: z.boolean(),
  dayHours:  z.record(
    z.string().regex(/^[0-6]$/),
    z.array(z.number().int().min(0).max(23))
  ),
});

// PUT — zamanlama ayarları (kullanıcıya özel)
settingsRouter.put('/schedule', async (req: Request, res: Response) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const dayHours: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(parsed.data.dayHours)) dayHours[Number(k)] = v;
  await setSchedule(req.user!.userId, { isEnabled: parsed.data.isEnabled, dayHours });
  res.json({ message: 'Zamanlama kaydedildi' });
});

// POST — bağlantı testi (sadece super_admin)
settingsRouter.post('/credentials/test', requireSuperAdmin, async (req: Request, res: Response) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  try { await validateSsrfSafeUrl(parsed.data.apiUrl); }
  catch (err) { res.status(400).json({ ok: false, message: err instanceof Error ? err.message : 'Geçersiz URL' }); return; }

  let { apiUrl, storeCode, apiUser, apiPass, apiToken } = parsed.data;

  if (!apiPass) {
    const stored = await getCredentials(req.user!.userId);
    if (!stored) {
      res.status(400).json({ ok: false, message: 'Önce bağlantı bilgilerini kaydedin' });
      return;
    }
    apiPass = stored.apiPass;
  }

  const result = await testConnection({ apiUrl, storeCode, apiUser, apiPass: apiPass!, apiToken });
  res.status(result.ok ? 200 : 400).json(result);
});
