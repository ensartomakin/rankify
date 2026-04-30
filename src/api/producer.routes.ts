import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, requireProducer, signToken, setAuthCookie } from './auth.middleware';
import {
  createTenant, listTenants, getTenantById, updateTenant, deleteTenant,
} from '../db/tenant.repo';
import {
  createUser, listUsers, deleteUser, findUserByEmail, findUserById,
} from '../db/user.repo';

export const producerRouter = Router();
producerRouter.use(requireAuth);
producerRouter.use(requireProducer);

// ── Tenant CRUD ────────────────────────────────────────────────────────────────

const tenantSchema = z.object({
  name:     z.string().min(1).max(255),
  slug:     z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug: küçük harf, rakam ve tire'),
  maxUsers: z.number().int().min(1).max(100).optional(),
});

producerRouter.get('/tenants', async (_req: Request, res: Response) => {
  const tenants = await listTenants();
  res.json(tenants);
});

producerRouter.post('/tenants', async (req: Request, res: Response) => {
  const parsed = tenantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { name, slug, maxUsers } = parsed.data;
  try {
    const tenant = await createTenant(name, slug, maxUsers);
    res.status(201).json(tenant);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      res.status(409).json({ error: 'Bu slug zaten kullanımda' }); return;
    }
    throw err;
  }
});

producerRouter.get('/tenants/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }
  const tenant = await getTenantById(id);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }
  res.json(tenant);
});

const updateTenantSchema = z.object({
  name:     z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  maxUsers: z.number().int().min(1).max(100).optional(),
});

producerRouter.put('/tenants/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }
  const parsed = updateTenantSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const tenant = await updateTenant(id, parsed.data);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }
  res.json(tenant);
});

producerRouter.delete('/tenants/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }
  const tenant = await getTenantById(id);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }
  await deleteTenant(id);
  res.json({ message: 'Tenant ve tüm kullanıcıları silindi' });
});

// ── Tenant kullanıcı yönetimi ──────────────────────────────────────────────────

producerRouter.get('/tenants/:id/users', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }
  const users = await listUsers(id);
  res.json(users);
});

const createUserSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  name:     z.string().min(1).optional(),
  role:     z.enum(['super_admin', 'user']).default('super_admin'),
});

producerRouter.post('/tenants/:id/users', async (req: Request, res: Response) => {
  const tenantId = parseInt(req.params.id, 10);
  if (isNaN(tenantId)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }

  const tenant = await getTenantById(tenantId);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const { email, password, name, role } = parsed.data;
  const existing = await findUserByEmail(email);
  if (existing) { res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser(email, passwordHash, name, role, tenantId);
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId });
});

producerRouter.delete('/tenants/:id/users/:uid', async (req: Request, res: Response) => {
  const tenantId = parseInt(req.params.id, 10);
  const userId   = parseInt(req.params.uid, 10);
  if (isNaN(tenantId) || isNaN(userId)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }

  const user = await findUserById(userId);
  if (!user || user.tenantId !== tenantId) {
    res.status(404).json({ error: 'Kullanıcı bu tenant\'a ait değil' }); return;
  }
  await deleteUser(userId);
  res.json({ message: 'Kullanıcı silindi' });
});

// ── Impersonation — producer olarak bir tenant super_admin'i gibi giriş yap ───

producerRouter.post('/tenants/:id/impersonate', async (req: Request, res: Response) => {
  const tenantId = parseInt(req.params.id, 10);
  if (isNaN(tenantId)) { res.status(400).json({ error: 'Geçersiz ID' }); return; }

  const tenant = await getTenantById(tenantId);
  if (!tenant) { res.status(404).json({ error: 'Tenant bulunamadı' }); return; }

  const users = await listUsers(tenantId);
  const superAdmin = users.find(u => u.role === 'super_admin');
  if (!superAdmin) { res.status(404).json({ error: 'Bu tenant\'ın super_admin\'i yok' }); return; }

  const token = signToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: superAdmin.role,
    tenantId,
  });
  setAuthCookie(res, token);
  res.json({
    token,
    user: { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: superAdmin.role, tenantId },
    impersonating: true,
    tenantName: tenant.name,
  });
});
