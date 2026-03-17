import type { Request, Response, NextFunction } from 'express';
import { verifyToken, isSessionValid } from '../services/auth/jwtService';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; deviceId: string; jti: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    const { valid, userId, deviceId } = await isSessionValid(payload.jti);
    if (!valid || !userId || !deviceId) {
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }
    req.user = { userId, deviceId, jti: payload.jti };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
