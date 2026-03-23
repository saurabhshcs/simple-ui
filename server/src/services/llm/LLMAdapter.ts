import type { Provider } from '@simple-ui/shared';

export interface LLMContentPart {
  type: 'text' | 'image';
  text?: string;
  data?: string;       // base64
  mimeType?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | LLMContentPart[];
}

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  supportsVision: boolean;
  contextWindow?: number;
}

export interface LLMAdapter {
  readonly provider: Provider;
  listModels(): Promise<ModelInfo[]>;
  streamChat(
    req: LLMRequest,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void,
  ): Promise<void>;
}
