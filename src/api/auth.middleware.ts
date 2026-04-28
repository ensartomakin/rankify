import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserById, type UserRole } from '../db/user.repo';

export interface AuthPayload {
  userId: number;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  // Validated at boot in index.ts — safe to assert here
  return process.env.JWT_SECRET!;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Accept httpOnly cookie first, then fall back to Authorization header (for API clients)
  const cookieToken = req.cookies?.['token'] as string | undefined;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = cookieToken ?? headerToken;

  if (!token) {
    res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthPayload;

    // Verify user still exists and fetch fresh role (catches deleted/demoted users)
    const dbUser = await findUserById(payload.userId);
    if (!dbUser) {
      res.status(401).json({ error: 'Kullanıcı bulunamadı' });
      return;
    }

    req.user = { userId: payload.userId, email: payload.email, role: dbUser.role };
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Bu işlem için süper admin yetkisi gerekli' });
    return;
  }
  next();
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge:   24 * 60 * 60 * 1000, // 1 gün
};

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '1d' });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, COOKIE_OPTIONS);
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('token', COOKIE_OPTIONS);
}
