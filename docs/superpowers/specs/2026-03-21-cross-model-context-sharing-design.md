# Cross-Model Context Sharing — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Scope:** Sub-project 1 of 5 (core differentiator feature)

---

## Problem

Simple UI supports multiple LLM providers (OpenAI, Anthropic, Gemini) but each conversation is locked to one model. Switching providers means starting a new conversation and losing all prior context. This eliminates the key advantage of a multi-provider interface.

## Goal

Allow users to switch the active model at any point in a conversation. The new model receives the full conversation history as context. Each assistant response is tagged with the model that generated it, giving users a clear visual record of which model said what.

---

## Approach: Soft Switch (Option A)

Same conversation, model changes going forward. The conversation remains a single unit in the sidebar. Context sharing is always-on — no opt-in toggle. The full message history is already sent on every request (existing behaviour), so switching models is transparent to the server's LLM adapters.

---

## Data Model Changes

### Migration (Knex format)

A new migration file `server/src/db/migrations/YYYYMMDDHHMMSS_add_model_to_messages.ts` using Knex schema builder:

```ts
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

Both columns are nullable — existing messages have no model tag.

### shared/types.ts

`StoredMessage` gains two optional fields:

```ts
export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  fileIds: string[];
  model?: string;      // NEW — which model generated/sent this message
  provider?: Provider; // NEW — which provider
  createdAt: number;
}
```

The `Conversation` record's existing `model` and `provider` columns now represent the **last active model** — updated on every send. This keeps the sidebar model label current after a mid-conversation switch.

---

## Server Changes (`server/src/routes/chat.ts`)

### POST /api/chat

1. **Save user message** — include `model` and `provider` from the request body when inserting into `messages`. (Intentional: records which model context the user was addressing at send time, useful for audit.)

2. **Save assistant message** — include `model` and `provider` when inserting after stream completes.

3. **Update conversation** — for existing conversations, extend the `WHERE { id, user_id }` update to include `model` and `provider` alongside `updated_at`:
   ```ts
   await db('conversations')
     .where({ id: convId, user_id: userId })
     .update({ updated_at: Date.now(), model, provider });
   ```
   New conversations already write `model` and `provider` at INSERT time — no change needed there.

### GET /api/chat/conversations/:id

The messages SELECT must include the new columns:

```ts
const messages = await db('messages')
  .where({ conversation_id: conv.id })
  .orderBy('created_at', 'asc')
  .select('id', 'role', 'content', 'file_ids', 'created_at', 'model', 'provider'); // NEW: model, provider
```

And the mapping block must forward them:

```ts
messages.map((m) => ({
  ...m,
  fileIds: JSON.parse(m.file_ids ?? '[]'),
  model: m.model ?? undefined,
  provider: m.provider ?? undefined,
}))
```

---

## Client Changes

### 1. `client/src/stores/chatStore.ts`

The internal `Message` type gains `model?: string` and `provider?: Provider`.

`finishStreaming(conversationId, fullContent, model, provider)` — the signature is extended to accept the active model and provider at the time streaming completes. These are written onto the assistant message entry in the store so the badge is available immediately without a reload.

After `finishStreaming`, update the in-memory `conversations` list entry for `conversationId` to reflect the new `model` and `provider`, so the sidebar label stays current without requiring a full conversation list reload:
```ts
set((s) => ({
  conversations: s.conversations.map((c) =>
    c.id === conversationId ? { ...c, model, provider } : c
  ),
}));
```

### 2. `client/src/hooks/useChat.ts`

`useChat` currently reads model/provider from `settingsStore`. The hook signature changes to accept them as explicit parameters:

```ts
function useChat(model: string, provider: Provider): { sendMessage, isStreaming, ... }
```

The `model` and `provider` arguments replace the `settingsStore` reads inside the hook for the purposes of building the `ChatRequest`. When calling `finishStreaming`, the hook passes the `model` and `provider` it received.

The `sendMessage` callback inside the hook is memoised with `useCallback`. The `settingsStore` reads currently in the dependency array must be replaced with the `model` and `provider` parameters: `useCallback(..., [..., model, provider])`. Omitting them would cause a stale-closure bug where mid-conversation model switches send the original model to the API.

### 3. `client/src/components/chat/ChatInput.tsx`

A compact model+provider selector is added to the left of the send button.

- **Initial value:** reads from `settingsStore.selectedModel` / `settingsStore.selectedProvider` for new conversations; re-initialises from the active conversation's `model`/`provider` when a conversation loads, via a `useEffect` keyed on `chatStore.activeConversationId`:
  ```ts
  useEffect(() => {
    const conv = chatStore.conversations.find(c => c.id === activeConversationId);
    if (conv) { setModel(conv.model); setProvider(conv.provider); }
  }, [activeConversationId]);
  ```
- **State:** local `useState` — `[model, setModel]` and `[provider, setProvider]`.
- **Passes to hook:** `useChat(model, provider)` — the hook is instantiated with the current local selection.

### 4. `client/src/components/chat/MessageBubble.tsx`

Assistant messages with a `model` value render a small badge:

- Position: top-right corner of the bubble.
- Content: provider colour dot + short model name (e.g. `● GPT-4o`, `◆ Claude 3.5 Sonnet`, `▲ Gemini 1.5 Pro`).
- User messages: no badge (user messages are tagged in the DB for audit, but the badge is not displayed).
- Messages loaded from history: badge renders from `message.model` / `message.provider` (populated by the updated GET route).
- **Known limitation — streaming placeholder:** During active streaming, `MessageList` renders a synthetic placeholder bubble (`{ id: 'streaming', ... }`) with no `model`/`provider`. The badge will not appear on this transient bubble and will snap into view only after `finishStreaming` commits the completed message. This is acceptable for the initial iteration; extending the placeholder with model data is deferred.

### 5. Sidebar conversation label

The sidebar reads the `Conversation.model` field from `chatStore.conversations`. After a mid-conversation model switch, the in-memory conversations list is updated by `finishStreaming` (see §chatStore above), so the sidebar label reflects the new model immediately — no reload or separate action required.

---

## UX Flow

1. User opens a conversation — the input bar model selector shows the conversation's current `model`/`provider` (or the global default for new conversations).
2. User sends several messages with GPT-4o → assistant bubbles tagged `● GPT-4o`.
3. User clicks the model selector in the input bar → switches to Claude 3.5 Sonnet.
4. Next send: all prior messages (GPT-4o turns + user turns) are sent as context to Claude.
5. Claude's response appears tagged `◆ Claude 3.5 Sonnet`.
6. Sidebar conversation label updates to `Claude 3.5 Sonnet` immediately.

---

## Error Handling

- If the user switches to a provider for which they have no API key, the existing error path applies: server returns `400 No API key configured for {provider}` and the UI shows the existing error toast. No new error states needed.

---

## Testing

**Unit:**
- `chatStore.test.ts` — assert `Message` type accepts `model`/`provider`; `finishStreaming` correctly stores model and provider on the assistant message; in-memory `conversations` list is updated with the new model after `finishStreaming`.
- `MessageBubble.test.tsx` — badge renders when `model` is set; no badge when `model` is absent.

**Integration (new test file: `server/src/__tests__/chat.integration.test.ts`):**
- Send a message with `model: 'gpt-4o'`, `provider: 'openai'` → assert messages row has correct `model` and `provider`.
- Send a second message with `model: 'claude-3-5-sonnet'`, `provider: 'anthropic'` in the same conversation → assert second messages row has correct model tag and `conversations.model` reflects `claude-3-5-sonnet`.

**Smoke:**
- Manual: start a conversation with GPT-4o, switch to Claude mid-conversation, verify Claude response includes full prior context and badge is correct.

---

## Out of Scope (this iteration)

- Option B (fork with context) and Option C (per-message hot-swap) — deferred.
- Opt-in context sharing toggle — always-on is the initial behaviour.
- Mobile-responsive model selector — basic desktop layout only.
- Rename chat history feature — separate sub-project.
- Custom agent skills (sa-agent, partner-agent, devsecops-agent, security-agent, test-agent, dev-agent) — separate initiative.
- Pre-sale pitch / marketing documentation — separate initiative.

---

## Implementation Order (4-day plan)

| Day | Work |
|-----|------|
| Day 1 | Knex migration + shared/types.ts update + server route changes (POST save + GET select) |
| Day 2 | chatStore type + `finishStreaming` signature + in-memory conversations update + `useChat` hook signature |
| Day 3 | `ChatInput` model selector UI + `useEffect` re-init + `MessageBubble` badge |
| Day 4 | Unit tests + integration tests + manual smoke test + commit/push |
