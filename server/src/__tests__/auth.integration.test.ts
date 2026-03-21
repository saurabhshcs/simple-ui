/**
 * Integration tests for auth routes.
 * Uses a real in-memory SQLite database (set via DB_PATH=:memory: in setup.ts)
 * and mocks only the email service (external I/O not under test).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../config/database';

// Mock email service — we test auth logic, not SMTP
vi.mock('../services/email/emailService', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendDeviceRegistrationEmail: vi.fn().mockResolvedValue(undefined),
}));

// Helper to read the raw OTP from the DB (we capture it because DEV mode logs it,
// and we can also read the hashed record directly)
async function getLatestOtpRecord(userId: string) {
  return db('otp_codes')
    .where({ user_id: userId, used: 0 })
    .orderBy('created_at', 'desc')
    .first();
}

beforeAll(async () => {
  // Create the schema tables needed for auth routes
  await db.schema.createTableIfNotExists('users', (t) => {
    t.text('id').primary();
    t.text('email').unique().notNullable();
    t.text('password').notNullable();
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
  });

  await db.schema.createTableIfNotExists('otp_codes', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('code').notNullable();
    t.integer('expires_at').notNullable();
    t.integer('used').notNullable().defaultTo(0);
    t.integer('created_at').notNullable();
  });

  await db.schema.createTableIfNotExists('devices', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('fingerprint').notNullable();
    t.text('name').notNullable();
    t.integer('confirmed').notNullable().defaultTo(0);
    t.text('confirm_token').nullable();
    t.integer('token_expires').nullable();
    t.integer('registered_at').nullable();
    t.integer('created_at').notNullable();
  });

  await db.schema.createTableIfNotExists('sessions', (t) => {
    t.text('id').primary(); // jti
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('device_id').notNullable().references('id').inTable('devices');
    t.integer('revoked').notNullable().defaultTo(0);
    t.integer('expires_at').notNullable();
    t.integer('created_at').notNullable();
  });
});

afterEach(async () => {
  // Clean up between tests so each test starts fresh
  await db('sessions').delete();
  await db('otp_codes').delete();
  await db('devices').delete();
  await db('users').delete();
});

const DEVICE = { deviceFingerprint: 'test-fp-abc', deviceName: 'Test Browser' };

describe('POST /api/auth/register', () => {
  it('creates a new account and returns 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@test.com', password: 'securePass1' });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/account created/i);
  });

  it('returns 409 when email is already registered', async () => {
    await request(app).post('/api/auth/register').send({ email: 'bob@test.com', password: 'securePass1' });
    const res = await request(app).post('/api/auth/register').send({ email: 'bob@test.com', password: 'securePass1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'securePass1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@test.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@test.com', password: 'myPassword1' });
  });

  it('sends OTP and returns otpSent + userId for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'myPassword1', ...DEVICE });

    expect(res.status).toBe(200);
    expect(res.body.otpSent).toBe(true);
    expect(typeof res.body.userId).toBe('string');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'WrongPass!', ...DEVICE });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 401 for non-existent email (same message — no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything', ...DEVICE });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('full happy path: register → login → verify OTP → get JWT', async () => {
    // 1. Register
    await request(app).post('/api/auth/register').send({ email: 'otp@test.com', password: 'myPassword1' });

    // 2. Login (triggers OTP creation)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'otp@test.com', password: 'myPassword1', ...DEVICE });

    expect(loginRes.body.otpSent).toBe(true);
    const { userId } = loginRes.body;

    // 3. Read the raw OTP code — we stored a hash, so we need bcrypt to get the plain code.
    //    Instead: we mock bcrypt.compare to always return true for simplicity,
    //    OR we read the OTP that the DEV mode logs to stdout.
    //    Cleanest: directly insert a known OTP code for this test.
    const bcrypt = await import('bcrypt');
    const knownCode = '123456';
    const hashed = await bcrypt.hash(knownCode, 1);
    await db('otp_codes').where({ user_id: userId }).update({ code: hashed });

    // 4. Verify OTP — new device → devicePending
    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, code: knownCode, ...DEVICE });

    // First login from a new device should be pending (awaiting device confirmation)
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.devicePending).toBe(true);

    // 5. Confirm the device
    const device = await db('devices').where({ user_id: userId }).first();
    expect(device).toBeTruthy();
    const confirmToken = device.confirm_token;

    const confirmRes = await request(app).get(`/api/auth/confirm-device?token=${confirmToken}`);
    expect(confirmRes.status).toBe(302); // redirect to /auth/device-confirmed

    // 6. Re-create a fresh OTP (previous one is now used)
    const knownCode2 = '654321';
    const hashed2 = await bcrypt.hash(knownCode2, 1);
    await db('otp_codes').insert({
      id: 'test-otp-2',
      user_id: userId,
      code: hashed2,
      expires_at: Date.now() + 600_000,
      used: 0,
      created_at: Date.now(),
    });

    // 7. Verify OTP again — device is now confirmed → get JWT
    const finalRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId, code: knownCode2, ...DEVICE });

    expect(finalRes.status).toBe(200);
    expect(typeof finalRes.body.token).toBe('string');
    expect(finalRes.body.user.email).toBe('otp@test.com');
  });

  it('returns 401 for an invalid OTP code', async () => {
    await request(app).post('/api/auth/register').send({ email: 'badotp@test.com', password: 'myPassword1' });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'badotp@test.com', password: 'myPassword1', ...DEVICE });

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ userId: loginRes.body.userId, code: '000000', ...DEVICE });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });
});
