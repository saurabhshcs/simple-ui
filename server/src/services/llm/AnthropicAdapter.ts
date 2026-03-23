import Anthropic from '@anthropic-ai/sdk';
import type { LLMAdapter, LLMMessage, LLMRequest, ModelInfo } from './LLMAdapter';

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-6',         name: 'Claude Opus 4.6',    provider: 'anthropic', supportsVision: true,  contextWindow: 200000 },
  { id: 'claude-sonnet-4-6',       name: 'Claude Sonnet 4.6',  provider: 'anthropic', supportsVision: true,  contextWindow: 200000 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', supportsVision: true,  contextWindow: 200000 },
];

export class AnthropicAdapter implements LLMAdapter {
  readonly provider = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS;
  }

  async streamChat(
    req: LLMRequest,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      const { systemPrompt, userMessages } = this.splitMessages(req.messages);

      const stream = this.client.messages.stream({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        system: systemPrompt,
        messages: userMessages,
      });

      // Iterate raw stream events to extract text deltas explicitly.
      // This is more reliable than stream.on('text', onToken) which passes
      // (textDelta, textSnapshot) — two args — to a callback typed for one.
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          onToken(event.delta.text);
        }
      }

      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private splitMessages(messages: LLMMessage[]): {
    systemPrompt: string | undefined;
    userMessages: Anthropic.MessageParam[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.length > 0
      ? (typeof systemMessages[0]!.content === 'string' ? systemMessages[0]!.content : undefined)
      : undefined;

    const userMessages: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role as 'user' | 'assistant', content: m.content };
        }
        const parts: Anthropic.ContentBlockParam[] = m.content.map((part) => {
          if (part.type === 'image' && part.data && part.mimeType) {
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: part.mimeType as Anthropic.Base64ImageSource['media_type'],
                data: part.data,
              },
            };
          }
          return { type: 'text' as const, text: part.text ?? '' };
        });
        return { role: 'user' as const, content: parts };
      });

    return { systemPrompt, userMessages };
  }
}
