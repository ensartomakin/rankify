import { Router, Request, Response } from 'express';
import { requireAuth } from './auth.middleware';
import { getAuditLogs } from '../db/audit.repo';

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get('/', async (req: Request, res: Response) => {
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const rawLimit   = Number(req.query.limit) || 30;
  const limit      = Math.min(Math.max(1, rawLimit), 200); // clamp 1-200
  const logs       = await getAuditLogs(req.user!.userId, categoryId, limit);
  res.json(logs);
});
