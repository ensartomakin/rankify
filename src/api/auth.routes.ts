import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  createUser, findUserByEmail, countUsers, producerExists,
} from '../db/user.repo';
import { signToken, requireAuth, setAuthCookie, clearAuthCookie } from './auth.middleware';

export const authRouter = Router();

let _dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!_dummyHashPromise) {
    _dummyHashPromise = bcrypt.hash('rankify-timing-protection-dummy', 12);
  }
  return _dummyHashPromise;
}

const registerSchema = z.object({
  email:          z.string().email(),
  password:       z.string().min(8),
  name:           z.string().min(1).optional(),
  // Mevcut veritabanlarında producer yoksa, bu alanla producer kurulumu yapılabilir
  producerSecret: z.string().optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// Kurulum durumu: producer yoksa needsSetup=true
authRouter.get('/setup', async (_req: Request, res: Response) => {
  const count = await countUsers();
  const hasProducer = await producerExists();
  res.json({ needsSetup: count === 0 || !hasProducer });
});

// Kayıt — sadece producer hesabı oluşturmak için kullanılır:
//   1. Hiç kullanıcı yoksa: direkt producer oluştur
//   2. Kullanıcı var ama producer yoksa: PRODUCER_SETUP_KEY env ile doğrulama gerekir
//   3. Producer zaten varsa: 403
authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, name, producerSecret } = parsed.data;

  const hasProducer = await producerExists();
  if (hasProducer) {
    res.status(403).json({ error: 'Sistem zaten kurulu. Yeni hesaplar üretici paneli üzerinden oluşturulur.' });
    return;
  }

  // Mevcut kullanıcılar varsa producer secret gerekli
  const totalUsers = await countUsers();
  if (totalUsers > 0) {
    const setupKey = process.env.PRODUCER_SETUP_KEY;
    if (!setupKey || producerSecret !== setupKey) {
      res.status(403).json({ error: 'Producer kurulumu için geçerli PRODUCER_SETUP_KEY gerekli' });
      return;
    }
  }

  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  // Producer'ın tenant_id'si yoktur (tüm tenant'lara erişir)
  const user = await createUser(email, passwordHash, name, 'producer', undefined);
  const token = signToken({ userId: user.id, email: user.email, role: user.role, tenantId: undefined });
  setAuthCookie(res, token);

  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  const hashToCheck = user?.passwordHash ?? await getDummyHash();
  const isMatch = await bcrypt.compare(password, hashToCheck);
  if (!user || !isMatch) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId });
  setAuthCookie(res, token);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json(req.user);
});
