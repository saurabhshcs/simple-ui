import { create } from 'zustand';
import type { Conversation, StoredMessage } from '@simple-ui/shared';

export interface PendingFile {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: StoredMessage[];
  isStreaming: boolean;
  streamingContent: string;
  pendingFiles: PendingFile[];

  setConversations: (list: Conversation[]) => void;
  setActiveConversation: (id: string | null, messages?: StoredMessage[]) => void;
  addMessage: (msg: StoredMessage) => void;
  startStreaming: () => void;
  appendToken: (token: string) => void;
  finishStreaming: (conversationId: string, fullContent: string, model: string, provider: string) => void;
  addPendingFile: (file: PendingFile) => void;
  removePendingFile: (fileId: string) => void;
  clearPendingFiles: () => void;
  prependConversation: (conv: Conversation) => void;
  updateConversationTitle: (id: string, title: string) => void;
  removeConversation: (id: string) => void;
  moveConversationToTop: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  pendingFiles: [],

  setConversations: (list) => set({ conversations: list }),

  setActiveConversation: (id, messages = []) =>
    set({ activeConversationId: id, messages }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  startStreaming: () => set({ isStreaming: true, streamingContent: '' }),

  appendToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

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

  addPendingFile: (file) =>
    set((s) => ({ pendingFiles: [...s.pendingFiles, file] })),

  removePendingFile: (fileId) =>
    set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.fileId !== fileId) })),

  clearPendingFiles: () => set({ pendingFiles: [] }),

  prependConversation: (conv) =>
    set((s) => ({ conversations: [conv, ...s.conversations] })),

  updateConversationTitle: (id, title) =>
    set((s) => ({
      conversations: s.conversations.map((c) => c.id === id ? { ...c, title } : c),
    })),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
      messages: s.activeConversationId === id ? [] : s.messages,
    })),

  moveConversationToTop: (id) =>
    set((s) => {
      const conv = s.conversations.find((c) => c.id === id);
      if (!conv) return {};
      return {
        conversations: [
          { ...conv, updatedAt: Date.now() },
          ...s.conversations.filter((c) => c.id !== id),
        ],
      };
    }),
}));
