import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export function MessageList() {
  const { messages, isStreaming, streamingContent } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Detect manual scroll-up to pause auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  };

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent, autoScroll]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-secondary">
        <div className="text-5xl mb-4">💬</div>
        <p className="text-lg font-medium">Start a conversation</p>
        <p className="text-sm mt-1">Type a message below to begin</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-4 space-y-1"
      style={{ scrollbarColor: 'var(--color-scrollbar) transparent' }}
    >
      {messages.map((msg, i) => {
        const isLastAssistant = !isStreaming && msg.role === 'assistant' && i === messages.length - 1;
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && isLastAssistant}
            streamingContent={isLastAssistant ? streamingContent : undefined}
          />
        );
      })}

      {isStreaming && (
        streamingContent === ''
          ? <TypingIndicator />
          : <MessageBubble
              key="streaming"
              message={{ id: 'streaming', conversationId: '', role: 'assistant', content: '', fileIds: [], createdAt: Date.now() }}
              isStreaming
              streamingContent={streamingContent}
            />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
