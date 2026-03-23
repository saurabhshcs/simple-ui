import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMAdapter, LLMMessage, LLMRequest, ModelInfo } from './LLMAdapter';

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.0-flash',     name: 'Gemini 2.0 Flash',    provider: 'gemini', supportsVision: true,  contextWindow: 1048576 },
  { id: 'gemini-1.5-pro',       name: 'Gemini 1.5 Pro',      provider: 'gemini', supportsVision: true,  contextWindow: 2097152 },
  { id: 'gemini-1.5-flash',     name: 'Gemini 1.5 Flash',    provider: 'gemini', supportsVision: true,  contextWindow: 1048576 },
];

export class GeminiAdapter implements LLMAdapter {
  readonly provider = 'gemini' as const;
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async listModels(): Promise<ModelInfo[]> {
    return GEMINI_MODELS;
  }

  async streamChat(
    req: LLMRequest,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      const model = this.genAI.getGenerativeModel({ model: req.model });
      const history = this.buildHistory(req.messages);
      const lastMessage = req.messages.at(-1);
      if (!lastMessage) throw new Error('No messages provided');

      const chat = model.startChat({ history });
      const lastContent = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : lastMessage.content.map((p) => p.text ?? '').join('');

      const result = await chat.sendMessageStream(lastContent);
      for await (const chunk of result.stream) {
        const token = chunk.text();
        if (token) onToken(token);
      }
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private buildHistory(messages: LLMMessage[]) {
    // Gemini uses 'user' and 'model' roles; exclude the last message (sent separately)
    return messages.slice(0, -1)
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : m.content.map((p) => p.text ?? '').join('') }],
      }));
  }
}
