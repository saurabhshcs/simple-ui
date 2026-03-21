import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../config/database';

vi.mock('../services/email/emailService', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendDeviceConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendDeviceRegistrationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/llm/OpenAIAdapter', () => ({
  OpenAIAdapter: vi.fn().mockImplementation(() => ({
    provider: 'openai',
    streamChat: vi.fn().mockImplementation((_r: unknown, onToken: (t: string) => void, onDone: () => Promise<void>) => {
      onToken('hello'); return onDone();
    }),
  })),
}));

vi.mock('../services/llm/AnthropicAdapter', () => ({
  AnthropicAdapter: vi.fn().mockImplementation(() => ({
    provider: 'anthropic',
    streamChat: vi.fn().mockImplementation((_r: unknown, onToken: (t: string) => void, onDone: () => Promise<void>) => {
      onToken('world'); return onDone();
    }),
  })),
}));

vi.mock('../services/llm/GeminiAdapter', () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    provider: 'gemini',
    streamChat: vi.fn(),
  })),
}));

import { encrypt } from '../services/auth/encryptionService';

import nodeCrypto from 'crypto';

function hashFingerprint(raw: string): string {
  return nodeCrypto.createHash('sha256').update(raw).digest('hex');
}

async function getToken(): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'chattest@example.com', password: 'Pass1234!' });
  const user = await db('users').where({ email: 'chattest@example.com' }).first();
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('000000', 1);
  await db('otp_codes').insert({ id: crypto.randomUUID(), user_id: user.id, code: hash, expires_at: Date.now() + 60000, used: 0, created_at: Date.now() });
  const hashedFp = hashFingerprint('fp-chat');
  const existingDevice = await db('devices').where({ user_id: user.id, fingerprint: hashedFp }).first();
  if (!existingDevice) {
    await db('devices').insert({ id: crypto.randomUUID(), user_id: user.id, fingerprint: hashedFp, name: 'Test', confirmed: 1, created_at: Date.now() });
  }
  const res = await request(app).post('/api/auth/verify-otp').send({ userId: user.id, code: '000000', deviceFingerprint: 'fp-chat', deviceName: 'Test' });
  return { token: res.body.token, userId: user.id };
}

beforeAll(async () => {
  // Create schema tables required for chat route integration tests
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
    t.text('name');
    t.integer('confirmed').notNullable().defaultTo(0);
    t.text('confirm_token').nullable();
    t.integer('token_expires').nullable();
    t.integer('registered_at').nullable();
    t.integer('created_at').notNullable();
  });
  await db.schema.createTableIfNotExists('sessions', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('device_id').notNullable().references('id').inTable('devices');
    t.integer('revoked').notNullable().defaultTo(0);
    t.integer('expires_at').notNullable();
    t.integer('created_at').notNullable();
  });
  await db.schema.createTableIfNotExists('api_keys', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('provider').notNullable();
    t.text('key_value').notNullable();
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
  });
  await db.schema.createTableIfNotExists('conversations', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('title').notNullable().defaultTo('New conversation');
    t.text('model').notNullable();
    t.text('provider').notNullable();
    t.integer('created_at').notNullable();
    t.integer('updated_at').notNullable();
  });
  await db.schema.createTableIfNotExists('messages', (t) => {
    t.text('id').primary();
    t.text('conversation_id').notNullable().references('id').inTable('conversations');
    t.text('role').notNullable();
    t.text('content').notNullable();
    t.text('file_ids').notNullable().defaultTo('[]');
    t.text('model').nullable();
    t.text('provider').nullable();
    t.integer('created_at').notNullable();
  });
  await db.schema.createTableIfNotExists('files', (t) => {
    t.text('id').primary();
    t.text('user_id').notNullable().references('id').inTable('users');
    t.text('filename').notNullable();
    t.text('mime_type').notNullable();
    t.text('path').notNullable();
    t.text('extracted_text').nullable();
    t.integer('created_at').notNullable();
  });

  const { userId } = await getToken();
  const existing = await db('api_keys').where({ user_id: userId, provider: 'openai' }).first();
  if (!existing) {
    await db('api_keys').insert({ id: crypto.randomUUID(), user_id: userId, provider: 'openai', key_value: encrypt('sk-test'), created_at: Date.now(), updated_at: Date.now() });
  }
});

afterEach(async () => {
  await db('messages').delete();
  await db('conversations').delete();
  await db('otp_codes').delete();
  await db('sessions').delete();
});

describe('POST /api/chat model persistence', () => {
  it('saves model and provider on the assistant message row', async () => {
    const { token } = await getToken();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'gpt-4o', provider: 'openai', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    const convId = res.headers['x-conversation-id'];
    const msg = await db('messages').where({ conversation_id: convId, role: 'assistant' }).first();
    expect(msg.model).toBe('gpt-4o');
    expect(msg.provider).toBe('openai');
  });

  it('updates conversation model/provider when model switches mid-conversation', async () => {
    const { token, userId } = await getToken();
    const r1 = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'gpt-4o', provider: 'openai', messages: [{ role: 'user', content: 'first' }] });
    const convId = r1.headers['x-conversation-id'];

    const existingAnthropicKey = await db('api_keys').where({ user_id: userId, provider: 'anthropic' }).first();
    if (!existingAnthropicKey) {
      await db('api_keys').insert({ id: crypto.randomUUID(), user_id: userId, provider: 'anthropic', key_value: encrypt('sk-ant-test'), created_at: Date.now(), updated_at: Date.now() });
    }

    const r2 = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ conversationId: convId, model: 'claude-3-5-sonnet-20241022', provider: 'anthropic', messages: [{ role: 'user', content: 'second' }] });
    expect(r2.status).toBe(200);

    const conv = await db('conversations').where({ id: convId }).first();
    expect(conv.model).toBe('claude-3-5-sonnet-20241022');
    expect(conv.provider).toBe('anthropic');
  });
});

describe('GET /api/chat/conversations/:id', () => {
  it('returns model and provider on stored messages', async () => {
    const { token } = await getToken();
    const r1 = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'gpt-4o', provider: 'openai', messages: [{ role: 'user', content: 'hello' }] });
    const convId = r1.headers['x-conversation-id'];

    const r2 = await request(app)
      .get(`/api/chat/conversations/${convId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(r2.status).toBe(200);
    const assistantMsg = r2.body.messages.find((m: { role: string }) => m.role === 'assistant');
    expect(assistantMsg.model).toBe('gpt-4o');
    expect(assistantMsg.provider).toBe('openai');
  });
});
