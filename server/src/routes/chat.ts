import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { createAdapter } from '../services/llm/adapterFactory';
import { decrypt } from '../services/auth/encryptionService';
import type { LLMMessage } from '../services/llm/LLMAdapter';
import type { Provider } from '@simple-ui/shared';

const router = Router();

const ChatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  model: z.string(),
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })),
  fileIds: z.array(z.string()).optional(),
});

// POST /api/chat  — SSE streaming response
router.post('/', requireAuth, async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const { conversationId, model, provider, messages, fileIds = [] } = parsed.data;
  const userId = req.user!.userId;

  // Fetch API key for this provider
  const keyRecord = await db('api_keys').where({ user_id: userId, provider }).first();
  if (!keyRecord) {
    res.status(400).json({ error: `No API key configured for ${provider}` });
    return;
  }
  const apiKey = decrypt(keyRecord.key_value);

  // Resolve file attachments into message content parts
  const llmMessages: LLMMessage[] = await Promise.all(messages.map(async (msg, idx) => {
    // Only attach files to the last user message
    const isLastUserMsg = idx === messages.length - 1 && msg.role === 'user' && fileIds.length > 0;
    if (!isLastUserMsg) return { role: msg.role, content: msg.content };

    const files = await db('files')
      .whereIn('id', fileIds)
      .where({ user_id: userId });

    const parts: LLMMessage['content'] = [{ type: 'text', text: msg.content }];
    for (const file of files) {
      if (file.mime_type.startsWith('image/')) {
        const fs = await import('fs/promises');
        const data = (await fs.readFile(file.path)).toString('base64');
        parts.push({ type: 'image', data, mimeType: file.mime_type });
      } else if (file.extracted_text) {
        parts.push({ type: 'text', text: `\n\n[Attached: ${file.filename}]\n${file.extracted_text}` });
      }
    }
    return { role: msg.role, content: parts as LLMMessage['content'] };
  }));

  // Create or fetch conversation
  let convId = conversationId;
  if (!convId) {
    convId = uuidv4();
    const now = Date.now();
    const title = messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'New conversation';
    await db('conversations').insert({
      id: convId, user_id: userId, title, model, provider, created_at: now, updated_at: now,
    });
  } else {
    await db('conversations').where({ id: convId, user_id: userId }).update({ updated_at: Date.now() });
  }

  // Save the user message
  const lastUserMsg = messages.at(-1);
  if (lastUserMsg?.role === 'user') {
    await db('messages').insert({
      id: uuidv4(),
      conversation_id: convId,
      role: 'user',
      content: lastUserMsg.content,
      file_ids: JSON.stringify(fileIds),
      created_at: Date.now(),
    });
  }

  // Stream response via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Conversation-Id', convId);
  res.flushHeaders();

  let fullResponse = '';
  const adapter = createAdapter(provider as Provider, apiKey);

  await adapter.streamChat(
    { model, messages: llmMessages },
    (token) => {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
    async () => {
      // Save assistant response to DB
      await db('messages').insert({
        id: uuidv4(),
        conversation_id: convId,
        role: 'assistant',
        content: fullResponse,
        file_ids: '[]',
        created_at: Date.now(),
      });
      res.write(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`);
      res.end();
    },
    (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    },
  );
});

// GET /api/chat/conversations
router.get('/conversations', requireAuth, async (req, res) => {
  const conversations = await db('conversations')
    .where({ user_id: req.user!.userId })
    .orderBy('updated_at', 'desc')
    .select('id', 'title', 'model', 'provider', 'created_at', 'updated_at');
  res.json(conversations);
});

// POST /api/chat/conversations
router.post('/conversations', requireAuth, async (req, res) => {
  const { model, provider } = z.object({
    model: z.string(),
    provider: z.enum(['openai', 'anthropic', 'gemini']),
  }).parse(req.body);

  const id = uuidv4();
  const now = Date.now();
  await db('conversations').insert({
    id, user_id: req.user!.userId, title: 'New conversation',
    model, provider, created_at: now, updated_at: now,
  });
  res.status(201).json({ id, title: 'New conversation', model, provider, createdAt: now, updatedAt: now });
});

// GET /api/chat/conversations/:id
router.get('/conversations/:id', requireAuth, async (req, res) => {
  const conv = await db('conversations').where({ id: req.params['id'], user_id: req.user!.userId }).first();
  if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return; }

  const messages = await db('messages')
    .where({ conversation_id: conv.id })
    .orderBy('created_at', 'asc')
    .select('id', 'role', 'content', 'file_ids', 'created_at');

  res.json({
    ...conv,
    messages: messages.map((m: { id: string; role: string; content: string; file_ids: string; created_at: number }) => ({
      ...m,
      fileIds: JSON.parse(m.file_ids ?? '[]'),
    })),
  });
});

// DELETE /api/chat/conversations/:id
router.delete('/conversations/:id', requireAuth, async (req, res) => {
  const deleted = await db('conversations')
    .where({ id: req.params['id'], user_id: req.user!.userId })
    .delete();
  if (!deleted) { res.status(404).json({ error: 'Conversation not found' }); return; }
  res.json({ message: 'Deleted' });
});

export default router;
