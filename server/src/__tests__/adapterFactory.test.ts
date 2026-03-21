import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the adapter modules before importing the factory so the factory
// picks up our mocks instead of the real SDK-dependent implementations.
vi.mock('../services/llm/OpenAIAdapter', () => ({
  OpenAIAdapter: vi.fn().mockImplementation(() => ({
    provider: 'openai',
    listModels: vi.fn().mockResolvedValue([{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', supportsVision: true }]),
    streamChat: vi.fn(),
  })),
}));

vi.mock('../services/llm/AnthropicAdapter', () => ({
  AnthropicAdapter: vi.fn().mockImplementation(() => ({
    provider: 'anthropic',
    listModels: vi.fn().mockResolvedValue([{ id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', supportsVision: true }]),
    streamChat: vi.fn(),
  })),
}));

vi.mock('../services/llm/GeminiAdapter', () => ({
  GeminiAdapter: vi.fn().mockImplementation(() => ({
    provider: 'gemini',
    listModels: vi.fn().mockResolvedValue([{ id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini', supportsVision: false }]),
    streamChat: vi.fn(),
  })),
}));

import { createAdapter, getCachedModels } from '../services/llm/adapterFactory';

describe('adapterFactory', () => {
  describe('createAdapter', () => {
    it('creates an OpenAI adapter for provider "openai"', () => {
      const adapter = createAdapter('openai', 'sk-key');
      expect(adapter.provider).toBe('openai');
    });

    it('creates an Anthropic adapter for provider "anthropic"', () => {
      const adapter = createAdapter('anthropic', 'sk-ant-key');
      expect(adapter.provider).toBe('anthropic');
    });

    it('creates a Gemini adapter for provider "gemini"', () => {
      const adapter = createAdapter('gemini', 'gemini-key');
      expect(adapter.provider).toBe('gemini');
    });

    it('throws for an unknown provider', () => {
      expect(() => createAdapter('unknown' as never, 'key')).toThrow('Unknown provider: unknown');
    });
  });

  describe('getCachedModels', () => {
    beforeEach(() => {
      // Reset module-level cache between tests by clearing vi module cache
      vi.resetModules();
    });

    it('calls listModels and returns model data', async () => {
      const models = await getCachedModels('openai', 'sk-key');
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toMatchObject({ provider: 'openai' });
    });

    it('returns the same data on repeated calls (cache hit)', async () => {
      // Use 'gemini' — not cached by the first test which used 'openai'
      const first = await getCachedModels('gemini', 'key');
      const second = await getCachedModels('gemini', 'key');
      // Both calls return identical data (the second is served from cache)
      expect(first).toEqual(second);
      expect(first[0]).toMatchObject({ provider: 'gemini' });
    });
  });
});
