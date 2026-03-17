import { Router } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../config/database';
import { config } from '../config/index';
import { createOtp, verifyOtp } from '../services/auth/otpService';
import { checkOrCreateDevice, confirmDevice } from '../services/auth/deviceService';
import { createSession, revokeSession } from '../services/auth/jwtService';
import { sendOtpEmail, sendDeviceRegistrationEmail } from '../services/email/emailService';
import { requireAuth } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  deviceFingerprint: z.string(),
  deviceName: z.string().default('Unknown device'),
});

const OtpSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6),
  deviceFingerprint: z.string(),
  deviceName: z.string().default('Unknown device'),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await db('users').where({ email }).first();
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const now = Date.now();
  const id = uuidv4();
  await db('users').insert({ id, email, password: hashed, created_at: now, updated_at: now });

  res.status(201).json({ message: 'Account created. Please log in.' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password, deviceFingerprint, deviceName } = parsed.data;

  const user = await db('users').where({ email }).first();
  const passwordMatch = user && await bcrypt.compare(password, user.password);
  if (!user || !passwordMatch) {
    // Generic message to prevent user enumeration
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const code = await createOtp(user.id);
  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    res.status(503).json({ error: 'Failed to send verification email. Please check SMTP configuration.' });
    return;
  }

  res.json({ otpSent: true, userId: user.id });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const parsed = OtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { userId, code, deviceFingerprint, deviceName } = parsed.data;

  const valid = await verifyOtp(userId, code);
  if (!valid) {
    res.status(401).json({ error: 'Invalid or expired code' });
    return;
  }

  const result = await checkOrCreateDevice(userId, deviceFingerprint, deviceName);

  if (result.status !== 'confirmed') {
    const user = await db('users').where({ id: userId }).first();
    const confirmUrl = `${config.clientUrl}/api/auth/confirm-device?token=${result.confirmToken}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n┌─────────────────────────────────────────────────────┐\n│  DEV DEVICE CONFIRM URL:                            │\n│  ${confirmUrl.padEnd(51)} │\n└─────────────────────────────────────────────────────┘\n`);
    }
    try {
      await sendDeviceRegistrationEmail(user.email, deviceName, confirmUrl);
    } catch (err) {
      console.error('Failed to send device registration email:', err);
    }
    res.json({ devicePending: true });
    return;
  }

  const { token, expiresAt } = await createSession(userId, result.deviceId);
  const user = await db('users').select('id', 'email').where({ id: userId }).first();
  res.json({ token, expiresAt, user });
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
  const user = await db('users').where({ id: userId }).first();
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const code = await createOtp(user.id);
  try {
    await sendOtpEmail(user.email, code);
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    res.status(503).json({ error: 'Failed to send verification email.' });
    return;
  }
  res.json({ otpSent: true });
});

// GET /api/auth/confirm-device?token=
router.get('/confirm-device', async (req, res) => {
  const token = String(req.query['token'] ?? '');
  const deviceId = await confirmDevice(token);

  if (!deviceId) {
    res.redirect(`${config.clientUrl}/auth/device-error`);
    return;
  }
  res.redirect(`${config.clientUrl}/auth/device-confirmed`);
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await revokeSession(req.user!.jti);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await db('users').select('id', 'email').where({ id: req.user!.userId }).first();
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(user);
});

export default router;
