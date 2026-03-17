import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const BCRYPT_ROUNDS = 10;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createOtp(userId: string): Promise<string> {
  const code = generateCode();
  const hashed = await bcrypt.hash(code, BCRYPT_ROUNDS);

  await db('otp_codes').insert({
    id: uuidv4(),
    user_id: userId,
    code: hashed,
    expires_at: Date.now() + OTP_TTL_MS,
    used: 0,
    created_at: Date.now(),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n┌─────────────────────────────┐\n│  DEV OTP CODE: ${code}     │\n└─────────────────────────────┘\n`);
  }
  return code; // raw code — sent via email, never stored plaintext
}

export async function verifyOtp(userId: string, submittedCode: string): Promise<boolean> {
  const record = await db('otp_codes')
    .where({ user_id: userId, used: 0 })
    .where('expires_at', '>', Date.now())
    .orderBy('created_at', 'desc')
    .first();

  if (!record) return false;

  const match = await bcrypt.compare(submittedCode, record.code);
  if (!match) return false;

  await db('otp_codes').where({ id: record.id }).update({ used: 1 });
  return true;
}

export async function invalidateUserOtps(userId: string): Promise<void> {
  await db('otp_codes').where({ user_id: userId }).update({ used: 1 });
}
