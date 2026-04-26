import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware';
import { upsertCredentials, getCredentials, hasCredentials } from '../db/credentials.repo';
import { getSchedule, setSchedule } from '../db/schedule.repo';
import { testConnection } from '../services/tsoft-client';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const credsSchema = z.object({
  apiUrl:    z.string().url('Geçerli bir URL girin'),
  storeCode: z.string().min(1),
  apiUser:   z.string().min(1),
  apiPass:   z.string().min(1),
  apiToken:  z.string().optional(),
});

// Test için şifre boş gelebilir — kayıtlı şifreyle tamamlanır
const testSchema = z.object({
  apiUrl:    z.string().url('Geçerli bir URL girin'),
  storeCode: z.string().min(1),
  apiUser:   z.string().min(1),
  apiPass:   z.string().optional(),
  apiToken:  z.string().optional(),
});

// GET — bağlantı bilgisi var mı + maskelenmiş özet
settingsRouter.get('/credentials', async (req: Request, res: Response) => {
  const creds = await getCredentials(req.user!.userId);
  if (!creds) { res.json({ configured: false }); return; }

  res.json({
    configured: true,
    apiUrl:    creds.apiUrl,
    storeCode: creds.storeCode,
    apiUser:   creds.apiUser,
    apiPass:   '••••••••',           // şifreyi asla gönderme
  });
});

// PUT — kaydet
settingsRouter.put('/credentials', async (req: Request, res: Response) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  await upsertCredentials(req.user!.userId, parsed.data);
  res.json({ message: 'Bağlantı bilgileri kaydedildi' });
});

// GET — zamanlama ayarları
settingsRouter.get('/schedule', async (req: Request, res: Response) => {
  const schedule = await getSchedule(req.user!.userId);
  res.json(schedule);
});

// PUT — zamanlama ayarları
const scheduleSchema = z.object({
  isEnabled: z.boolean(),
  dayHours:  z.record(
    z.string().regex(/^[0-6]$/),
    z.array(z.number().int().min(0).max(23))
  ),
});

settingsRouter.put('/schedule', async (req: Request, res: Response) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const dayHours: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(parsed.data.dayHours)) dayHours[Number(k)] = v;
  await setSchedule(req.user!.userId, { isEnabled: parsed.data.isEnabled, dayHours });
  res.json({ message: 'Zamanlama kaydedildi' });
});

// POST — bağlantı testi (şifre boşsa kayıtlı şifre kullanılır)
settingsRouter.post('/credentials/test', async (req: Request, res: Response) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  let { apiUrl, storeCode, apiUser, apiPass, apiToken } = parsed.data;

  // Şifre gönderilmediyse DB'den al
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
