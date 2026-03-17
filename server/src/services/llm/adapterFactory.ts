import type { Provider } from '@simple-ui/shared';
import type { LLMAdapter, ModelInfo } from './LLMAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GeminiAdapter } from './GeminiAdapter';

export function createAdapter(provider: Provider, apiKey: string): LLMAdapter {
  switch (provider) {
    case 'openai':    return new OpenAIAdapter(apiKey);
    case 'anthropic': return new AnthropicAdapter(apiKey);
    case 'gemini':    return new GeminiAdapter(apiKey);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// In-memory model list cache: provider → { data, cachedAt }
const modelCache = new Map<string, { data: ModelInfo[]; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCachedModels(provider: Provider, apiKey: string): Promise<ModelInfo[]> {
  const cached = modelCache.get(provider);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const adapter = createAdapter(provider, apiKey);
  const data = await adapter.listModels();
  modelCache.set(provider, { data, cachedAt: Date.now() });
  return data;
}
