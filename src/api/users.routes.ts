import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from './auth.middleware';
import { listUsers, createUser, deleteUser, countUsers, findUserByEmail } from '../db/user.repo';
import { getTenantById } from '../db/tenant.repo';

export const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requireSuperAdmin);

usersRouter.get('/', async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const users = await listUsers(tenantId);
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

  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(400).json({ error: 'Geçersiz tenant' }); return; }

  // Tenant limitini kontrol et
  const tenant = await getTenantById(tenantId);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }

  const tenantUserCount = await countUsers(tenantId);
  if (tenantUserCount >= tenant.maxUsers) {
    res.status(409).json({ error: `Bu marka için en fazla ${tenant.maxUsers} kullanıcı eklenebilir` });
    return;
  }

  const { email, password, name } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser(email, passwordHash, name, 'user', tenantId);
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

usersRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz kullanıcı ID' }); return; }
  if (id === req.user!.userId) {
    res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    return;
  }

  // Sadece kendi tenant'ındaki kullanıcıları silebilir
  const tenantUsers = await listUsers(req.user!.tenantId);
  if (!tenantUsers.some(u => u.id === id)) {
    res.status(403).json({ error: 'Bu kullanıcıyı silme yetkiniz yok' });
    return;
  }

  await deleteUser(id);
  res.json({ message: 'Kullanıcı silindi' });
});
