# Cross-Model Context Sharing — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to switch LLM models mid-conversation while sharing full context, with per-message model badges showing which AI generated each response.

**Architecture:** Add `model`/`provider` columns to the `messages` table. The server saves these on every message insert and returns them in the conversation GET. The client lifts available-models into `settingsStore`, adds a per-conversation model selector in `ChatInput`, updates `finishStreaming` to record the active model on the in-memory message, and renders a badge in `MessageBubble`.

**Tech Stack:** Knex migrations (SQLite/PostgreSQL), Express.js routes, Zustand stores, React hooks, Vitest + Supertest for tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `server/src/db/migrations/009_add_model_to_messages.ts` | Add model/provider columns to messages table |
| Modify | `shared/types.ts` | Add model/provider fields to StoredMessage |
| Modify | `server/src/routes/chat.ts` | Save model/provider on insert; return in GET; update conversation on switch |
| Modify | `client/src/stores/settingsStore.ts` | Add availableModels list so ChatInput can read it without a second API call |
| Modify | `client/src/components/layout/TopBar.tsx` | Populate settingsStore.availableModels when models are fetched |
| Modify | `client/src/stores/chatStore.ts` | Extend finishStreaming to accept model/provider; update in-memory conversations |
| Modify | `client/src/hooks/useChat.ts` | Accept model/provider params; pass to finishStreaming; fix useCallback deps |
| Modify | `client/src/components/chat/ChatInput.tsx` | Add model selector; wire to useChat(model, provider) |
| Modify | `client/src/components/layout/Sidebar.tsx` | Forward model/provider in message mapping from GET response |
| Modify | `client/src/components/chat/MessageBubble.tsx` | Render model badge on assistant messages |
| Create | `server/src/__tests__/chat.integration.test.ts` | Integration tests for model persistence and retrieval |
| Modify | `client/src/__tests__/chatStore.test.ts` | Tests for updated finishStreaming and conversations update |

---

## Task 1: DB Migration

**Files:**
- Create: `server/src/db/migrations/009_add_model_to_messages.ts`

- [ ] **Step 1: Create the migration file**

```ts
// server/src/db/migrations/009_add_model_to_messages.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('messages', (t) => {
    t.text('model').nullable();
    t.text('provider').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('messages', (t) => {
    t.dropColumn('model');
    t.dropColumn('provider');
  });
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run migrate
```

Expected: `Batch 2 run: 1 migrations` with no errors.

- [ ] **Step 3: Verify the schema**

```bash
node -e "const k=require('knex')({client:'sqlite3',connection:{filename:'server/data/simple-ui.sqlite'},useNullAsDefault:true});k('messages').columnInfo().then(c=>{console.log(Object.keys(c));k.destroy();})"
```

Expected output includes `model` and `provider`.

- [ ] **Step 4: Commit**

```bash
git add server/src/db/migrations/009_add_model_to_messages.ts
git commit -m "feat: add model/provider columns to messages table"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `shared/types.ts:89-96`

- [ ] **Step 1: Update StoredMessage — add optional model and provider**

In `shared/types.ts`, replace the `StoredMessage` interface:

```ts
export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  fileIds: string[];
  model?: string;       // which model generated/sent this message
  provider?: Provider;  // which provider
  createdAt: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build -w server
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types.ts
git commit -m "feat: add model/provider fields to StoredMessage"
```

---

## Task 3: Server Route — Save and Return Model

**Files:**
- Modify: `server/src/routes/chat.ts`
- Create: `server/src/__tests__/chat.integration.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `server/src/__tests__/chat.integration.test.ts`. The test suite:
- Mocks the LLM adapters (no real API keys needed): each adapter's `streamChat` calls `onToken('hello')` then `onDone()`.
- Gets an auth token via the register → OTP → verify flow (same pattern as `auth.integration.test.ts`).
- Seeds an encrypted OpenAI API key directly into the DB.
- Asserts `messages.model` and `messages.provider` are saved after a chat POST.
- Asserts `conversations.model` and `conversations.provider` update when model switches mid-conversation.
- Asserts the GET conversations/:id response includes `model`/`provider` on each message.

```ts
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db } from '../config/database';

vi.mock('../services/email/emailService', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendDeviceConfirmationEmail: vi.fn().mockResolvedValue(undefined),
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

async function getToken(): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/auth/register').send({ email: 'chattest@example.com', password: 'Pass1234!' });
  const user = await db('users').where({ email: 'chattest@example.com' }).first();
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.hash('000000', 1);
  await db('otp_codes').insert({ id: crypto.randomUUID(), user_id: user.id, code_hash: hash, expires_at: Date.now() + 60000, used: 0 });
  await db('devices').insert({ id: crypto.randomUUID(), user_id: user.id, fingerprint: 'fp-chat', name: 'Test', confirmed: 1, created_at: Date.now() });
  const res = await request(app).post('/api/auth/verify-otp').send({ userId: user.id, code: '000000', deviceFingerprint: 'fp-chat', deviceName: 'Test' });
  return { token: res.body.token, userId: user.id };
}

beforeAll(async () => {
  const { userId } = await getToken();
  const existing = await db('api_keys').where({ user_id: userId, provider: 'openai' }).first();
  if (!existing) {
    await db('api_keys').insert({ id: crypto.randomUUID(), user_id: userId, provider: 'openai', key_value: encrypt('sk-test'), updated_at: Date.now() });
  }
});

afterEach(async () => {
  await db('messages').delete();
  await db('conversations').delete();
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

    await db('api_keys').insert({ id: crypto.randomUUID(), user_id: userId, provider: 'anthropic', key_value: encrypt('sk-ant-test'), updated_at: Date.now() });

    await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ conversationId: convId, model: 'claude-3-5-sonnet-20241022', provider: 'anthropic', messages: [{ role: 'user', content: 'second' }] });

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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -w server 2>&1 | grep -E "(FAIL|PASS|model)"
```

Expected: tests fail because `msg.model` is `null` (column exists from migration but is not populated yet).

- [ ] **Step 3: Update POST /api/chat — save model/provider on user message insert**

In `server/src/routes/chat.ts` around line 81, add `model` and `provider` to the user message INSERT:

```ts
await db('messages').insert({
  id: uuidv4(),
  conversation_id: convId,
  role: 'user',
  content: lastUserMsg.content,
  file_ids: JSON.stringify(fileIds),
  model,          // NEW
  provider,       // NEW
  created_at: Date.now(),
});
```

- [ ] **Step 4: Update POST /api/chat — save model/provider on assistant message insert**

In the `onDone` callback around line 109:

```ts
await db('messages').insert({
  id: uuidv4(),
  conversation_id: convId,
  role: 'assistant',
  content: fullResponse,
  file_ids: '[]',
  model,          // NEW
  provider,       // NEW
  created_at: Date.now(),
});
```

- [ ] **Step 5: Update POST /api/chat — update conversation model/provider on every send**

Around line 75, replace the existing-conversation update:

```ts
// Before (only updated_at):
await db('conversations').where({ id: convId, user_id: userId }).update({ updated_at: Date.now() });

// After (also update model and provider):
await db('conversations').where({ id: convId, user_id: userId }).update({ updated_at: Date.now(), model, provider });
```

- [ ] **Step 6: Update GET /api/chat/conversations/:id — select model/provider from messages**

Around line 158, update the SELECT:

```ts
const messages = await db('messages')
  .where({ conversation_id: conv.id })
  .orderBy('created_at', 'asc')
  .select('id', 'role', 'content', 'file_ids', 'created_at', 'model', 'provider');
```

Update the mapping block to forward the new fields:

```ts
res.json({
  ...conv,
  messages: messages.map((m: {
    id: string; role: string; content: string;
    file_ids: string; created_at: number;
    model?: string; provider?: string;
  }) => ({
    ...m,
    fileIds: JSON.parse(m.file_ids ?? '[]'),
    model: m.model ?? undefined,
    provider: m.provider ?? undefined,
  })),
});
```

- [ ] **Step 7: Run server tests and confirm all pass**

```bash
npm test -w server
```

Expected: all tests pass including the new chat.integration.test.ts.

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/chat.ts server/src/__tests__/chat.integration.test.ts
git commit -m "feat: persist and return model/provider on messages"
```

---

## Task 4: settingsStore — Add availableModels

**Files:**
- Modify: `client/src/stores/settingsStore.ts`
- Modify: `client/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Update settingsStore interface and initial state**

In `client/src/stores/settingsStore.ts`, add the import and extend the interface:

```ts
import type { ModelInfo } from '@simple-ui/shared';  // add at top

// In SettingsState interface, add:
availableModels: ModelInfo[];
setAvailableModels: (models: ModelInfo[]) => void;
```

In the `create<SettingsState>` body, add the initial value and action:

```ts
availableModels: [],
setAvailableModels: (models) => set({ availableModels: models }),
```

- [ ] **Step 2: Update TopBar to populate availableModels**

In `client/src/components/layout/TopBar.tsx`:

Destructure `setAvailableModels` from `useSettingsStore()`:

```ts
const { selectedModel, setModel, setTheme, activeTheme, modelsVersion, setAvailableModels } = useSettingsStore();
```

Inside the useEffect `.then` block, call it after `setModels`:

```ts
setModels(fetched);
setAvailableModels(fetched);  // NEW — share with ChatInput via store
```

- [ ] **Step 3: Build to verify no errors**

```bash
npm run build -w client
```

- [ ] **Step 4: Commit**

```bash
git add client/src/stores/settingsStore.ts client/src/components/layout/TopBar.tsx
git commit -m "feat: lift availableModels into settingsStore"
```

---

## Task 5: chatStore — Update finishStreaming

**Files:**
- Modify: `client/src/stores/chatStore.ts`
- Modify: `client/src/__tests__/chatStore.test.ts`

- [ ] **Step 1: Add failing tests to chatStore.test.ts**

In `client/src/__tests__/chatStore.test.ts`, add a new describe block:

```ts
describe('finishStreaming with model/provider', () => {
  beforeEach(() => {
    useChatStore.setState({
      conversations: [],
      messages: [],
      isStreaming: false,
      streamingContent: '',
    });
  });

  it('records model and provider on the committed assistant message', () => {
    act(() => {
      useChatStore.getState().startStreaming();
      useChatStore.getState().appendToken('hello');
      useChatStore.getState().finishStreaming('conv-1', 'hello world', 'gpt-4o', 'openai');
    });
    const msg = useChatStore.getState().messages.at(-1);
    expect(msg?.model).toBe('gpt-4o');
    expect(msg?.provider).toBe('openai');
    expect(msg?.role).toBe('assistant');
  });

  it('updates the in-memory conversations list with the new model/provider', () => {
    act(() => {
      useChatStore.setState({
        conversations: [{ id: 'conv-1', title: 'Test', model: 'gpt-4o', provider: 'openai', createdAt: 0, updatedAt: 0 }],
      });
    });
    act(() => {
      useChatStore.getState().finishStreaming('conv-1', 'response', 'claude-3-5-sonnet-20241022', 'anthropic');
    });
    const conv = useChatStore.getState().conversations.find(c => c.id === 'conv-1');
    expect(conv?.model).toBe('claude-3-5-sonnet-20241022');
    expect(conv?.provider).toBe('anthropic');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -w client 2>&1 | grep -A5 "finishStreaming with model"
```

- [ ] **Step 3: Update chatStore — interface signature**

In `client/src/stores/chatStore.ts`, update the `ChatState` interface:

```ts
finishStreaming: (conversationId: string, fullContent: string, model: string, provider: string) => void;
```

- [ ] **Step 4: Update chatStore — implementation**

Replace the `finishStreaming` implementation:

```ts
finishStreaming: (conversationId, fullContent, model, provider) => {
  if (typeof fullContent !== 'string') {
    console.warn('[chatStore] finishStreaming received non-string content:', typeof fullContent, fullContent);
  }
  return set((s) => ({
    isStreaming: false,
    streamingContent: '',
    messages: [
      ...s.messages,
      {
        id: crypto.randomUUID(),
        conversationId,
        role: 'assistant',
        content: typeof fullContent === 'string' ? fullContent : String(fullContent),
        fileIds: [],
        model,
        provider,
        createdAt: Date.now(),
      },
    ],
    // Update the in-memory sidebar entry so the label reflects the switched model immediately
    conversations: s.conversations.map((c) =>
      c.id === conversationId ? { ...c, model, provider } : c
    ),
  }));
},
```

- [ ] **Step 5: Run tests and confirm they pass**

```bash
npm test -w client
```

- [ ] **Step 6: Commit**

```bash
git add client/src/stores/chatStore.ts client/src/__tests__/chatStore.test.ts
git commit -m "feat: extend finishStreaming with model/provider; update in-memory conversations"
```

---

## Task 6: useChat Hook — Accept Model/Provider Parameters

**Files:**
- Modify: `client/src/hooks/useChat.ts`

- [ ] **Step 1: Update the hook**

Replace `client/src/hooks/useChat.ts` with the version below. Key changes:
1. Remove `useSettingsStore` import and usage.
2. Add `model: string, provider: Provider` parameters.
3. Replace all `selectedModel`/`selectedProvider` references with the parameters.
4. Update `useCallback` deps from `[store, selectedModel, selectedProvider]` to `[store, model, provider]`.
5. Pass `model, provider` to `store.finishStreaming(...)`.

```ts
import { useCallback } from 'react';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage, Provider } from '@simple-ui/shared';

// model and provider come from ChatInput's local state (per-conversation).
// They are NOT read from settingsStore here. This prevents a stale-closure bug:
// if model/provider were captured from the store at hook creation time, switching
// models mid-conversation would silently send the old model.
export function useChat(model: string, provider: Provider) {
  const store = useChatStore();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || store.isStreaming) return;

    if (!model) {
      store.addMessage({
        id: crypto.randomUUID(),
        conversationId: store.activeConversationId ?? '',
        role: 'assistant',
        content: 'No model selected. Please add an API key in Settings and select a model.',
        fileIds: [],
        createdAt: Date.now(),
      });
      return;
    }

    const fileIds = store.pendingFiles.map((f) => f.fileId);
    const authToken = localStorage.getItem('auth_token');
    const isNewConversation = !store.activeConversationId;

    const historyMessages: ChatMessage[] = store.messages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));
    const allMessages = [...historyMessages, { role: 'user' as const, content: text }];

    store.addMessage({
      id: crypto.randomUUID(),
      conversationId: store.activeConversationId ?? '',
      role: 'user',
      content: text,
      fileIds,
      createdAt: Date.now(),
    });
    store.clearPendingFiles();
    store.startStreaming();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          conversationId: store.activeConversationId,
          model,
          provider,
          messages: allMessages,
          fileIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Chat request failed');
      }

      const newConvId = res.headers.get('X-Conversation-Id');
      const reader = res.body!
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();

      let fullContent = '';
      let finalConvId = store.activeConversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.data === '[DONE]') break;
        const parsed = JSON.parse(value.data) as {
          token?: string; done?: boolean; conversationId?: string; error?: string;
        };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) { fullContent += parsed.token; store.appendToken(parsed.token); }
        if (parsed.done && parsed.conversationId) finalConvId = parsed.conversationId;
      }

      const convId = finalConvId ?? newConvId ?? crypto.randomUUID();
      store.finishStreaming(convId, fullContent, model, provider);

      if (isNewConversation) {
        store.setActiveConversation(convId);
        store.prependConversation({ id: convId, title: text.slice(0, 60), model, provider, createdAt: Date.now(), updatedAt: Date.now() });
      } else {
        store.moveConversationToTop(convId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      store.finishStreaming(store.activeConversationId ?? '', '', model, provider);
      store.addMessage({
        id: crypto.randomUUID(),
        conversationId: store.activeConversationId ?? '',
        role: 'assistant',
        content: `Error: ${msg}`,
        fileIds: [],
        createdAt: Date.now(),
      });
    }
  // model and provider MUST be in this array — they replace the removed settingsStore reads.
  }, [store, model, provider]);

  return { sendMessage, isStreaming: store.isStreaming };
}
```

- [ ] **Step 2: Build — expect ChatInput.tsx errors (correct — will fix next)**

```bash
npm run build -w client 2>&1 | grep "ChatInput"
```

Expected: TypeScript error on `useChat()` call with no arguments in ChatInput.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useChat.ts
git commit -m "feat: useChat accepts model/provider params, fixes stale-closure on model switch"
```

---

## Task 7: ChatInput — Model Selector + Sidebar Message Mapping

**Files:**
- Modify: `client/src/components/chat/ChatInput.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace ChatInput with model-selector version**

Replace `client/src/components/chat/ChatInput.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useChat } from '../../hooks/useChat';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { apiClient } from '../../api/client';
import { FileAttachmentList } from './FileAttachment';
import type { Provider, UploadedFile } from '@simple-ui/shared';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

export function ChatInput() {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel, selectedProvider, availableModels } = useSettingsStore();
  const { activeConversationId, conversations } = useChatStore();

  // Per-conversation model state. Initialized from global settings; re-synced
  // when the user opens a different conversation.
  const [model, setModel] = useState<string>(selectedModel ?? '');
  const [provider, setProvider] = useState<Provider>((selectedProvider ?? 'openai') as Provider);

  useEffect(() => {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (conv && conv.model) {
      setModel(conv.model);
      setProvider(conv.provider as Provider);
    } else {
      setModel(selectedModel ?? '');
      setProvider((selectedProvider ?? 'openai') as Provider);
    }
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { sendMessage, isStreaming } = useChat(model, provider);
  const addPendingFile = useChatStore((s) => s.addPendingFile);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = availableModels.find(m => m.id === e.target.value);
    if (selected) { setModel(selected.id); setProvider(selected.provider); }
  };

  const onDrop = async (files: File[]) => {
    setUploadError('');
    setUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { setUploadError(`${file.name} is too large (max 5MB)`); continue; }
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await apiClient.post<UploadedFile>('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        addPendingFile({ fileId: res.data.fileId, filename: res.data.filename, mimeType: res.data.mimeType, size: res.data.size });
      } catch { setUploadError(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, accept: ACCEPTED_TYPES, noClick: true, noKeyboard: true, maxSize: 5 * 1024 * 1024 });

  const handleSubmit = async () => {
    if (!text.trim() || isStreaming || uploading) return;
    const msg = text;
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="border-t border-border-color bg-bg-primary">
      <FileAttachmentList />
      {uploadError && <p className="text-red-400 text-xs px-4 pt-2">{uploadError}</p>}
      <div
        {...getRootProps()}
        className={`relative m-4 rounded-2xl border border-border-color bg-bg-input transition-colors ${isDragActive ? 'border-accent bg-accent/10' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10 bg-bg-primary/80">
            <p className="text-accent font-medium">Drop files here</p>
          </div>
        )}
        <div className="flex items-end gap-2 p-3">
          <button onClick={open} disabled={uploading} title="Attach file"
            className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0 pb-0.5 disabled:opacity-40">
            {uploading ? '...' : 'attach'}
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Message... (Shift+Enter for new line)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-text-primary placeholder-text-secondary resize-none focus:outline-none text-sm leading-relaxed max-h-40 disabled:opacity-50"
          />
          {availableModels.length > 0 && (
            <select
              value={model}
              onChange={handleModelChange}
              disabled={isStreaming}
              title="Switch model for this conversation"
              className="flex-shrink-0 text-xs bg-bg-secondary border border-border-color text-text-secondary rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40 max-w-[120px]"
            >
              {(['openai', 'anthropic', 'gemini'] as const).map((p) => {
                const group = availableModels.filter(m => m.provider === p);
                if (!group.length) return null;
                return (
                  <optgroup key={p} label={p.charAt(0).toUpperCase() + p.slice(1)}>
                    {group.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                );
              })}
            </select>
          )}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || isStreaming || uploading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            {isStreaming ? 'stop' : 'send'}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-text-secondary pb-3 -mt-2">AI can make mistakes. Verify important information.</p>
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar.tsx message mapping to forward model/provider**

In `client/src/components/layout/Sidebar.tsx`, both the initial load mapping (lines ~24-31) and the `openConversation` mapping (lines ~40-47) need model/provider forwarded.

In the initial load (inside `useEffect`), update the map:

```ts
setActiveConversation(latest.id, res.data.messages.map((m: {
  id: string; role: string; content: string; fileIds: string[];
  created_at: number; model?: string; provider?: string;
}) => ({
  id: m.id,
  conversationId: latest.id,
  role: m.role,
  content: m.content,
  fileIds: m.fileIds ?? [],
  model: m.model ?? undefined,
  provider: m.provider ?? undefined,
  createdAt: m.created_at,
})));
```

In `openConversation`, update the map:

```ts
setActiveConversation(id, res.data.messages.map((m: {
  id: string; role: string; content: string; fileIds: string[];
  created_at: number; model?: string; provider?: string;
}) => ({
  id: m.id,
  conversationId: id,
  role: m.role,
  content: m.content,
  fileIds: m.fileIds ?? [],
  model: m.model ?? undefined,
  provider: m.provider ?? undefined,
  createdAt: m.created_at,
})));
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npm run build -w client
```

Expected: no errors.

- [ ] **Step 4: Run client tests**

```bash
npm test -w client
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/chat/ChatInput.tsx client/src/components/layout/Sidebar.tsx
git commit -m "feat: add per-conversation model selector in chat input"
```

---

## Task 8: MessageBubble — Model Badge

**Files:**
- Modify: `client/src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Update MessageBubble to render model badge**

Replace `client/src/components/chat/MessageBubble.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { clsx } from 'clsx';
import type { StoredMessage, Provider } from '@simple-ui/shared';

interface Props {
  message: StoredMessage;
  isStreaming?: boolean;
  streamingContent?: string;
}

const PROVIDER_STYLE: Record<Provider, { dot: string }> = {
  openai:    { dot: 'bg-green-500' },
  anthropic: { dot: 'bg-orange-400' },
  gemini:    { dot: 'bg-blue-400' },
};

export function MessageBubble({ message, isStreaming, streamingContent }: Props) {
  const isUser = message.role === 'user';
  const content = (isStreaming && !isUser) ? (streamingContent ?? '') : message.content;
  const providerStyle = !isUser && message.provider ? PROVIDER_STYLE[message.provider as Provider] : null;

  return (
    <div className={clsx('flex gap-3 px-4 py-3', isUser && 'flex-row-reverse')}>
      <div className={clsx(
        'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white',
        isUser ? 'bg-accent' : 'bg-text-secondary',
      )}>
        {isUser ? 'You' : 'AI'}
      </div>

      <div className={clsx(
        'relative max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-user-bubble text-white rounded-tr-sm'
          : 'bg-ai-bubble text-text-primary rounded-tl-sm',
      )}>
        {/* Model badge — shown on assistant messages that have a model tag.
            Known limitation: this badge is absent on the live streaming placeholder bubble.
            It snaps into view when finishStreaming commits the completed message. */}
        {providerStyle && message.model && (
          <div className="absolute -top-2 right-3 flex items-center gap-1 bg-bg-secondary border border-border-color rounded-full px-2 py-0.5 text-[10px] text-text-secondary whitespace-nowrap">
            <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', providerStyle.dot)} />
            <span className="truncate max-w-[100px]">{message.model}</span>
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <ReactMarkdown
            components={{
              code({ className, children }) {
                const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? '';
                const code = String(children).replace(/\n$/, '');
                if (!className) return <code className="px-1 py-0.5 rounded bg-code-bg font-mono text-xs">{children}</code>;
                return <CodeBlock language={lang} code={code} />;
              },
              p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
              ul({ children }) { return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>; },
              ol({ children }) { return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>; },
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {isStreaming && !isUser && (
          <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build -w client
```

Expected: clean build.

- [ ] **Step 3: Run all tests**

```bash
npm test -w server && npm test -w client
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/MessageBubble.tsx
git commit -m "feat: show model badge on assistant messages"
```

---

## Task 9: Manual Smoke Test + Push

- [ ] **Step 1: Start the app**

```bash
mailpit &
npm run dev
```

- [ ] **Step 2: Smoke test checklist**

1. Log in at `http://localhost:5173`.
2. Confirm model selector appears in the chat input bar (left of send button). If no models show, add an API key in Settings first.
3. Send a message with GPT-4o. Verify assistant bubble shows a green dot + `gpt-4o` label badge.
4. Click the model selector → switch to a Claude model.
5. Send another message. Verify Claude's response shows an orange dot + claude model name badge. The prior GPT-4o message still shows its green badge.
6. Reload the page. Open the same conversation from the sidebar. Verify both messages load with their correct badges.
7. Confirm the model selector in the input bar shows the last-used model (Claude) after reloading.

- [ ] **Step 3: Push to remote**

```bash
git push
```

---

## Done

Feature is complete when:
- `npm test -w server` passes (including chat.integration.test.ts)
- `npm test -w client` passes (including updated chatStore.test.ts)
- Manual smoke confirms per-message badges + model selector + context continuity across model switch
