import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../../config/database';

const DEVICE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashFingerprint(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export interface DeviceCheckResult {
  status: 'confirmed' | 'pending' | 'new';
  deviceId: string;
  confirmToken?: string;
}

export async function checkOrCreateDevice(
  userId: string,
  rawFingerprint: string,
  deviceName: string,
): Promise<DeviceCheckResult> {
  const fingerprint = hashFingerprint(rawFingerprint);

  const existing = await db('devices').where({ user_id: userId, fingerprint }).first();

  if (existing) {
    if (existing.confirmed) {
      return { status: 'confirmed', deviceId: existing.id };
    }
    // Regenerate registration token in case the previous one expired
    const confirmToken = uuidv4();
    await db('devices').where({ id: existing.id }).update({
      confirm_token: confirmToken,
      token_expires: Date.now() + DEVICE_TOKEN_TTL_MS,
    });
    return { status: 'pending', deviceId: existing.id, confirmToken };
  }

  // New device
  const deviceId = uuidv4();
  const confirmToken = uuidv4();
  await db('devices').insert({
    id: deviceId,
    user_id: userId,
    fingerprint,
    name: deviceName || 'Unknown device',
    confirmed: 0,
    confirm_token: confirmToken,
    token_expires: Date.now() + DEVICE_TOKEN_TTL_MS,
    created_at: Date.now(),
  });

  return { status: 'new', deviceId, confirmToken };
}

export async function confirmDevice(token: string): Promise<string | null> {
  const device = await db('devices')
    .where({ confirm_token: token })
    .where('token_expires', '>', Date.now())
    .first();

  if (!device) return null;

  await db('devices').where({ id: device.id }).update({
    confirmed: 1,
    confirm_token: null,
    token_expires: null,
    registered_at: Date.now(),
  });

  return device.id;
}
