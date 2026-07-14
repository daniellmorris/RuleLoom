import { mockProvider } from './mock.js';
import { openAiProvider } from './openai.js';
import type { AiProvider } from './types.js';

const providers = new Map<string, AiProvider>([
  [mockProvider.name, mockProvider],
  [openAiProvider.name, openAiProvider],
]);

export function getAiProvider(name?: string): AiProvider {
  const providerName = name ?? 'mock';
  const provider = providers.get(providerName);
  if (!provider) {
    throw new Error(`Unknown AI provider "${providerName}".`);
  }
  return provider;
}

export function listAiProviders(): string[] {
  return Array.from(providers.keys()).sort();
}

export type { AiProvider, GenerateRequest, GenerateResult, EmbedRequest, EmbedResult } from './types.js';
