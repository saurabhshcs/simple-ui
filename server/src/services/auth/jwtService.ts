import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index';
import { db } from '../../config/database';

interface JwtPayload {
  sub: string;       // userId
  deviceId: string;
  jti: string;
}

export function signToken(userId: string, deviceId: string): { token: string; jti: string; expiresAt: number } {
  const jti = uuidv4();
  const expiresIn = config.jwtExpiresIn;
  const token = jwt.sign({ sub: userId, deviceId, jti } as JwtPayload, config.jwtSecret, { expiresIn } as jwt.SignOptions);

  // Compute numeric expiry for DB storage
  const decoded = jwt.decode(token) as { exp: number };
  const expiresAt = decoded.exp * 1000;

  return { token, jti, expiresAt };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export async function createSession(userId: string, deviceId: string): Promise<{ token: string; expiresAt: number }> {
  const { token, jti, expiresAt } = signToken(userId, deviceId);
  await db('sessions').insert({
    id: jti,
    user_id: userId,
    device_id: deviceId,
    revoked: 0,
    expires_at: expiresAt,
    created_at: Date.now(),
  });
  return { token, expiresAt };
}

export async function revokeSession(jti: string): Promise<void> {
  await db('sessions').where({ id: jti }).update({ revoked: 1 });
}

export async function isSessionValid(jti: string): Promise<{ valid: boolean; userId?: string; deviceId?: string }> {
  const session = await db('sessions')
    .join('devices', 'sessions.device_id', 'devices.id')
    .where('sessions.id', jti)
    .where('sessions.revoked', 0)
    .where('sessions.expires_at', '>', Date.now())
    .where('devices.confirmed', 1)
    .select('sessions.user_id', 'sessions.device_id')
    .first();

  if (!session) return { valid: false };
  return { valid: true, userId: session.user_id, deviceId: session.device_id };
}
