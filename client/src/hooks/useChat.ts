import { useCallback } from 'react';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { ChatMessage } from '@simple-ui/shared';

export function useChat() {
  const store = useChatStore();
  const { selectedModel, selectedProvider } = useSettingsStore();

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || store.isStreaming) return;

    if (!selectedModel) {
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
    const token = localStorage.getItem('auth_token');
    const isNewConversation = !store.activeConversationId;

    // Build message history for the request
    const historyMessages: ChatMessage[] = store.messages.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));
    const userMessage: ChatMessage = { role: 'user', content: text };
    const allMessages = [...historyMessages, userMessage];

    // Optimistically add user message to UI
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: store.activeConversationId,
          model: selectedModel,
          provider: selectedProvider,
          messages: allMessages,
          fileIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Chat request failed');
      }

      // Get conversation ID from response header
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

        const parsed = JSON.parse(value.data) as { token?: string; done?: boolean; conversationId?: string; error?: string };

        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) {
          fullContent += parsed.token;
          store.appendToken(parsed.token);
        }
        if (parsed.done && parsed.conversationId) {
          finalConvId = parsed.conversationId;
        }
      }

      const convId = finalConvId ?? newConvId ?? crypto.randomUUID();
      store.finishStreaming(convId, fullContent);

      if (isNewConversation) {
        // Add new conversation to the top of the sidebar
        store.setActiveConversation(convId);
        store.prependConversation({
          id: convId,
          title: text.slice(0, 60),
          model: selectedModel,
          provider: selectedProvider,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else {
        // Bubble existing conversation to top (most recently used)
        store.moveConversationToTop(convId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      store.finishStreaming(store.activeConversationId ?? '', '');
      store.addMessage({
        id: crypto.randomUUID(),
        conversationId: store.activeConversationId ?? '',
        role: 'assistant',
        content: `⚠️ ${msg}`,
        fileIds: [],
        createdAt: Date.now(),
      });
    }
  }, [store, selectedModel, selectedProvider]);

  return { sendMessage, isStreaming: store.isStreaming };
}
