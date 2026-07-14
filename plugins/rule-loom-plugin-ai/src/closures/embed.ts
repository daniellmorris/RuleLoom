import { getAiProvider } from '../providers/index.js';
import type { AiClosureDefinition } from '../types.js';

export function aiEmbedClosure(): AiClosureDefinition {
  return {
    namespace: 'ai',
    version: '0.1.0',
    name: 'ai.embed',
    capabilities: ['network'],
    description: 'Create embeddings for text using a configured AI provider.',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const provider = getAiProvider(params.provider as string | undefined);
      if (!provider.embed) {
        throw new Error(`AI provider "${provider.name}" does not support embeddings.`);
      }
      return provider.embed({
        model: params.model as string | undefined,
        input: params.input as string | string[],
        apiKey: params.apiKey as string | undefined,
        providerOptions: params.providerOptions as Record<string, unknown> | undefined,
      });
    },
    signature: {
      description: 'Provider-neutral embedding generation.',
      parameters: [
        { name: 'provider', type: 'string', description: 'AI provider id, e.g. mock or openai.', defaultValue: 'mock' },
        { name: 'model', type: 'string', description: 'Embedding model id.' },
        { name: 'apiKey', type: 'string', description: 'Provider API key or resolved secret. Not required for mock.' },
        { name: 'input', type: 'any', required: true, description: 'String or string array to embed.' },
        { name: 'providerOptions', type: 'object', description: 'Provider-specific request options.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'object', description: 'Embedding result with embeddings, usage, model, and optional raw response.' },
    },
  };
}
