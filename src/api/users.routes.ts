import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { listUsers, createUser, deleteUser, countUsers, findUserByEmail } from '../db/user.repo';

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requireSuperAdmin);

const MAX_USERS = 4; // 1 super_admin + 3 kullanıcı

usersRouter.get('/', async (_req: Request, res: Response) => {
  const users = await listUsers();
  res.json(users);
});

const createSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).optional(),
});

usersRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const count = await countUsers();
  if (count >= MAX_USERS) {
    res.status(409).json({ error: `En fazla ${MAX_USERS - 1} kullanıcı eklenebilir` });
    return;
  }

  const { email, password, name } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser(email, passwordHash, name, 'user');
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

usersRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz kullanıcı ID' }); return; }
  if (id === req.user!.userId) {
    res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    return;
  }
  await deleteUser(id);
  res.json({ message: 'Kullanıcı silindi' });
});
