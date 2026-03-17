import { Router } from 'express';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { getCachedModels } from '../services/llm/adapterFactory';
import { decrypt } from '../services/auth/encryptionService';
import type { Provider } from '@simple-ui/shared';

const router = Router();

// GET /api/models — returns available models based on user's configured API keys
router.get('/', requireAuth, async (req, res) => {
  const apiKeys = await db('api_keys')
    .where({ user_id: req.user!.userId })
    .select('provider', 'key_value');

  const results = await Promise.allSettled(
    apiKeys.map(async (row: { provider: string; key_value: string }) => {
      const apiKey = decrypt(row.key_value);
      return getCachedModels(row.provider as Provider, apiKey);
    }),
  );

  const models = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof getCachedModels>>>).value);

  res.json(models);
});

export default router;
