import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useChatStore } from '../stores/chatStore';
import type { Conversation, StoredMessage } from '@simple-ui/shared';

function makeMsg(overrides: Partial<StoredMessage> = {}): StoredMessage {
  return {
    id: crypto.randomUUID(),
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    fileIds: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'Test conversation',
    model: 'gpt-4o',
    provider: 'openai',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  // Reset store state between tests
  act(() => {
    useChatStore.setState({
      conversations: [],
      activeConversationId: null,
      messages: [],
      isStreaming: false,
      streamingContent: '',
      pendingFiles: [],
    });
  });
});

describe('chatStore', () => {
  describe('setConversations', () => {
    it('replaces the conversations list', () => {
      const convs = [makeConv(), makeConv()];
      act(() => useChatStore.getState().setConversations(convs));
      expect(useChatStore.getState().conversations).toHaveLength(2);
    });
  });

  describe('setActiveConversation', () => {
    it('sets active ID and clears messages by default', () => {
      act(() => {
        useChatStore.getState().addMessage(makeMsg());
        useChatStore.getState().setActiveConversation('conv-2');
      });
      const s = useChatStore.getState();
      expect(s.activeConversationId).toBe('conv-2');
      expect(s.messages).toHaveLength(0);
    });

    it('sets messages when provided', () => {
      const msgs = [makeMsg(), makeMsg()];
      act(() => useChatStore.getState().setActiveConversation('conv-3', msgs));
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
  });

  describe('addMessage', () => {
    it('appends a message to the list', () => {
      const msg = makeMsg({ content: 'First' });
      act(() => useChatStore.getState().addMessage(msg));
      expect(useChatStore.getState().messages[0]?.content).toBe('First');
    });
  });

  describe('streaming lifecycle', () => {
    it('startStreaming sets isStreaming and clears streamingContent', () => {
      act(() => useChatStore.getState().startStreaming());
      const s = useChatStore.getState();
      expect(s.isStreaming).toBe(true);
      expect(s.streamingContent).toBe('');
    });

    it('appendToken accumulates content', () => {
      act(() => {
        useChatStore.getState().startStreaming();
        useChatStore.getState().appendToken('Hello');
        useChatStore.getState().appendToken(', world');
      });
      expect(useChatStore.getState().streamingContent).toBe('Hello, world');
    });

    it('finishStreaming stops streaming and appends the assistant message', () => {
      act(() => {
        useChatStore.getState().startStreaming();
        useChatStore.getState().appendToken('Full response');
        useChatStore.getState().finishStreaming('conv-1', 'Full response');
      });
      const s = useChatStore.getState();
      expect(s.isStreaming).toBe(false);
      expect(s.streamingContent).toBe('');
      const last = s.messages[s.messages.length - 1]!;
      expect(last.role).toBe('assistant');
      expect(last.content).toBe('Full response');
      expect(last.conversationId).toBe('conv-1');
    });
  });

  describe('pending files', () => {
    it('addPendingFile adds to the list', () => {
      act(() => useChatStore.getState().addPendingFile({ fileId: 'f1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024 }));
      expect(useChatStore.getState().pendingFiles).toHaveLength(1);
    });

    it('removePendingFile removes by fileId', () => {
      act(() => {
        useChatStore.getState().addPendingFile({ fileId: 'f1', filename: 'a.pdf', mimeType: 'application/pdf', size: 1 });
        useChatStore.getState().addPendingFile({ fileId: 'f2', filename: 'b.pdf', mimeType: 'application/pdf', size: 1 });
        useChatStore.getState().removePendingFile('f1');
      });
      const files = useChatStore.getState().pendingFiles;
      expect(files).toHaveLength(1);
      expect(files[0]?.fileId).toBe('f2');
    });

    it('clearPendingFiles empties the list', () => {
      act(() => {
        useChatStore.getState().addPendingFile({ fileId: 'f1', filename: 'x.pdf', mimeType: 'application/pdf', size: 1 });
        useChatStore.getState().clearPendingFiles();
      });
      expect(useChatStore.getState().pendingFiles).toHaveLength(0);
    });
  });

  describe('conversation management', () => {
    it('prependConversation adds to the front', () => {
      const a = makeConv({ title: 'A' });
      const b = makeConv({ title: 'B' });
      act(() => {
        useChatStore.getState().setConversations([a]);
        useChatStore.getState().prependConversation(b);
      });
      expect(useChatStore.getState().conversations[0]?.title).toBe('B');
    });

    it('updateConversationTitle updates by id', () => {
      const conv = makeConv({ id: 'c1', title: 'Old' });
      act(() => {
        useChatStore.getState().setConversations([conv]);
        useChatStore.getState().updateConversationTitle('c1', 'New Title');
      });
      expect(useChatStore.getState().conversations[0]?.title).toBe('New Title');
    });

    it('removeConversation removes and clears active if it was active', () => {
      const conv = makeConv({ id: 'c1' });
      act(() => {
        useChatStore.getState().setConversations([conv]);
        useChatStore.getState().setActiveConversation('c1', [makeMsg()]);
        useChatStore.getState().removeConversation('c1');
      });
      const s = useChatStore.getState();
      expect(s.conversations).toHaveLength(0);
      expect(s.activeConversationId).toBeNull();
      expect(s.messages).toHaveLength(0);
    });

    it('moveConversationToTop bubbles the conversation and updates updatedAt', () => {
      const old = Date.now() - 10000;
      const a = makeConv({ id: 'a', updatedAt: old });
      const b = makeConv({ id: 'b', updatedAt: old });
      act(() => {
        useChatStore.getState().setConversations([a, b]);
        useChatStore.getState().moveConversationToTop('b');
      });
      const s = useChatStore.getState();
      expect(s.conversations[0]?.id).toBe('b');
      expect(s.conversations[0]!.updatedAt).toBeGreaterThan(old);
    });
  });
});
