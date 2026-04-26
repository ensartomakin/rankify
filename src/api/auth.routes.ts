import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createUser, findUserByEmail } from '../db/user.repo';
import { signToken, requireAuth } from './auth.middleware';

export const authRouter = Router();

const registerSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/register', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, name } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user         = await createUser(email, passwordHash, name);
  const token        = signToken({ userId: user.id, email: user.email });

  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json(req.user);
});
