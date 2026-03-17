import OpenAI from 'openai';
import type { LLMAdapter, LLMMessage, LLMRequest, ModelInfo } from './LLMAdapter';

export class OpenAIAdapter implements LLMAdapter {
  readonly provider = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    const list = await this.client.models.list();
    return list.data
      .filter((m) => m.id.startsWith('gpt-'))
      .map((m) => ({
        id: m.id,
        name: m.id,
        provider: this.provider,
        supportsVision: m.id.includes('vision') || m.id.includes('gpt-4o') || m.id.includes('gpt-4-turbo'),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async streamChat(
    req: LLMRequest,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      const messages = req.messages.map((m) => this.convertMessage(m));
      const stream = await this.client.chat.completions.create({
        model: req.model,
        messages,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) onToken(token);
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private convertMessage(msg: LLMMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam;
    }
    // Multi-part (vision) message
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map((part) => {
      if (part.type === 'image' && part.data && part.mimeType) {
        return {
          type: 'image_url',
          image_url: { url: `data:${part.mimeType};base64,${part.data}` },
        };
      }
      return { type: 'text', text: part.text ?? '' };
    });
    return { role: 'user', content: parts };
  }
}
