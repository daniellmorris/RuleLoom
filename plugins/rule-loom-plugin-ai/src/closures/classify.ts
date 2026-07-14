import { getAiProvider } from '../providers/index.js';
import type { AiClosureDefinition } from '../types.js';

export function aiClassifyClosure(): AiClosureDefinition {
  return {
    namespace: 'ai',
    version: '0.1.0',
    name: 'ai.classify',
    description: 'Classify input into one of a fixed set of labels.',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const labels = Array.isArray(params.labels) ? params.labels.map(String) : [];
      if (!labels.length) {
        throw new Error('ai.classify requires at least one label.');
      }
      const provider = getAiProvider(params.provider as string | undefined);
      const schema = {
        type: 'object',
        properties: {
          label: { type: 'string', enum: labels },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['label'],
      };
      const result = await provider.generate({
        model: params.model as string | undefined,
        system: params.system as string | undefined,
        prompt: (params.prompt as string | undefined) ?? `Classify the input as one of: ${labels.join(', ')}. Return JSON.`,
        input: params.input,
        responseFormat: 'json',
        schema,
        apiKey: params.apiKey as string | undefined,
        providerOptions: params.providerOptions as Record<string, unknown> | undefined,
      });
      return result.json ?? { label: labels[0], confidence: 0, raw: result };
    },
    signature: {
      description: 'Classification helper with constrained labels.',
      parameters: [
        { name: 'provider', type: 'string', description: 'AI provider id, e.g. mock or openai.', defaultValue: 'mock' },
        { name: 'model', type: 'string', description: 'Provider model id.' },
        { name: 'apiKey', type: 'string', description: 'Provider API key or resolved secret. Not required for mock.' },
        { name: 'input', type: 'any', required: true, description: 'Text or object to classify.' },
        { name: 'labels', type: 'array', required: true, description: 'Allowed labels.' },
        { name: 'system', type: 'string', description: 'Optional classification instructions.' },
        { name: 'prompt', type: 'string', description: 'Optional prompt override.' },
        { name: 'providerOptions', type: 'object', description: 'Provider-specific request options.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'object', description: 'Classification result with label, confidence, and reason when available.' },
    },
  };
}
