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
        content: '⚠️ No model selected. Please add an API key in Settings and select a model from the dropdown.',
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
        store.prependConversation({
          id: convId,
          title: text.slice(0, 60),
          model,
          provider,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        store.moveConversationToTop(convId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      store.finishStreaming(store.activeConversationId ?? '', '', model, provider);
      store.addMessage({
        id: crypto.randomUUID(),
        conversationId: store.activeConversationId ?? '',
        role: 'assistant',
        content: `⚠️ ${msg}`,
        fileIds: [],
        createdAt: Date.now(),
      });
    }
  // model and provider MUST be in this array — they replace the removed settingsStore reads.
  }, [store, model, provider]);

  return { sendMessage, isStreaming: store.isStreaming };
}
