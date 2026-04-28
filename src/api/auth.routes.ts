import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createUser, findUserByEmail, countUsers } from '../db/user.repo';
import { signToken, requireAuth, setAuthCookie, clearAuthCookie } from './auth.middleware';

export const authRouter = Router();

// Precomputed once at startup — prevents user-enumeration via timing differences
let _dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = await bcrypt.hash('rankify-timing-protection-dummy', 12);
  return _dummyHash;
}

const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// İlk kurulum gerekip gerekmediğini döner (kimlik doğrulama gerektirmez)
authRouter.get('/setup', async (_req: Request, res: Response) => {
  const count = await countUsers();
  res.json({ needsSetup: count === 0 });
});

// Kayıt — sadece hiç kullanıcı yoksa (ilk kurulum) çalışır
// Sonraki kullanıcılar /api/users endpoint'i üzerinden super admin tarafından eklenir
authRouter.post('/register', async (req: Request, res: Response) => {
  const count = await countUsers();
  if (count > 0) {
    res.status(403).json({ error: 'Kayıt kapalı. Kullanıcılar yönetici tarafından eklenir.' });
    return;
  }

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, name } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  // İlk kullanıcı her zaman super_admin
  const user = await createUser(email, passwordHash, name, 'super_admin');
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);

  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  // Always run bcrypt to prevent timing-based user enumeration
  const hashToCheck = user?.passwordHash ?? await getDummyHash();
  const isMatch = await bcrypt.compare(password, hashToCheck);
  if (!user || !isMatch) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setAuthCookie(res, token);
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json(req.user);
});
