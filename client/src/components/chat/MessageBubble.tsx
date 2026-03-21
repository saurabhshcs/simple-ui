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
