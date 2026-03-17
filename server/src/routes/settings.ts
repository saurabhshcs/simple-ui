import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { encrypt, decrypt } from '../services/auth/encryptionService';
import { config } from '../config/index';

const router = Router();

const bgStorage = multer.diskStorage({
  destination: path.join(config.uploadDir, 'backgrounds'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const bgUpload = multer({
  storage: bgStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

// GET /api/settings/api-keys
router.get('/api-keys', requireAuth, async (req, res) => {
  const keys = await db('api_keys')
    .where({ user_id: req.user!.userId })
    .select('provider', 'key_value', 'updated_at');

  const masked = keys.map((k: { provider: string; key_value: string; updated_at: number }) => {
    let maskedKey = '****';
    try {
      const raw = decrypt(k.key_value);
      maskedKey = `...${raw.slice(-4)}`;
    } catch {
      // ignore decryption errors for masked view
    }
    return { provider: k.provider, maskedKey, updatedAt: k.updated_at };
  });

  res.json(masked);
});

// PUT /api/settings/api-keys/:provider
router.put('/api-keys/:provider', requireAuth, async (req, res) => {
  const provider = z.enum(['openai', 'anthropic', 'gemini']).parse(req.params['provider']);
  const { keyValue } = z.object({ keyValue: z.string().min(10) }).parse(req.body);

  const encrypted = encrypt(keyValue);
  const now = Date.now();
  const existing = await db('api_keys').where({ user_id: req.user!.userId, provider }).first();

  if (existing) {
    await db('api_keys').where({ user_id: req.user!.userId, provider })
      .update({ key_value: encrypted, updated_at: now });
  } else {
    await db('api_keys').insert({
      id: uuidv4(),
      user_id: req.user!.userId,
      provider,
      key_value: encrypted,
      created_at: now,
      updated_at: now,
    });
  }

  res.json({ message: 'API key saved' });
});

// DELETE /api/settings/api-keys/:provider
router.delete('/api-keys/:provider', requireAuth, async (req, res) => {
  const provider = z.enum(['openai', 'anthropic', 'gemini']).parse(req.params['provider']);
  await db('api_keys').where({ user_id: req.user!.userId, provider }).delete();
  res.json({ message: 'API key removed' });
});

// PUT /api/settings/background
router.put('/background', requireAuth, bgUpload.single('image'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }
  const url = `/uploads/backgrounds/${req.file.filename}`;
  res.json({ url });
});

// DELETE /api/settings/background
router.delete('/background', requireAuth, async (req, res) => {
  const { filename } = z.object({ filename: z.string() }).parse(req.body);
  const filePath = path.join(config.uploadDir, 'backgrounds', path.basename(filename));
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be deleted
  }
  res.json({ message: 'Background removed' });
});

export default router;
