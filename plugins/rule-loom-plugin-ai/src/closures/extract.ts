import { getAiProvider } from '../providers/index.js';
import type { AiClosureDefinition } from '../types.js';

export function aiExtractClosure(): AiClosureDefinition {
  return {
    namespace: 'ai',
    version: '0.1.0',
    name: 'ai.extract',
    capabilities: ['network'],
    description: 'Extract structured data from text or state using a schema.',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const provider = getAiProvider(params.provider as string | undefined);
      const result = await provider.generate({
        model: params.model as string | undefined,
        system: params.system as string | undefined,
        prompt:
          (params.prompt as string | undefined) ??
          'Extract structured data from the input. Return only JSON matching the requested schema.',
        input: params.input,
        responseFormat: 'json',
        schema: params.schema,
        apiKey: params.apiKey as string | undefined,
        providerOptions: params.providerOptions as Record<string, unknown> | undefined,
      });
      return result.json ?? result;
    },
    signature: {
      description: 'Structured extraction helper that returns parsed JSON when available.',
      parameters: [
        { name: 'provider', type: 'string', description: 'AI provider id, e.g. mock or openai.', defaultValue: 'mock' },
        { name: 'model', type: 'string', description: 'Provider model id.' },
        { name: 'apiKey', type: 'string', description: 'Provider API key or resolved secret. Not required for mock.' },
        { name: 'input', type: 'any', required: true, description: 'Text or object to extract from.' },
        { name: 'schema', type: 'object', required: true, description: 'JSON schema describing the extracted object.' },
        { name: 'system', type: 'string', description: 'Optional extraction instructions.' },
        { name: 'prompt', type: 'string', description: 'Optional prompt override.' },
        { name: 'providerOptions', type: 'object', description: 'Provider-specific request options.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'any', description: 'Extracted JSON object when available.' },
    },
  };
}
