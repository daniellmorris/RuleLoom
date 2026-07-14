import { getAiProvider } from '../providers/index.js';
import type { AiClosureDefinition } from '../types.js';

export function aiGenerateClosure(): AiClosureDefinition {
  return {
    namespace: 'ai',
    version: '0.1.0',
    name: 'ai.generate',
    capabilities: ['network'],
    description: 'Generate text or JSON with a configured AI provider.',
    handler: async (_state, context) => {
      const params = context.parameters ?? {};
      const provider = getAiProvider(params.provider as string | undefined);
      return provider.generate({
        model: params.model as string | undefined,
        system: params.system as string | undefined,
        prompt: params.prompt as string | undefined,
        messages: params.messages as any,
        input: params.input,
        temperature: params.temperature as number | undefined,
        maxOutputTokens: params.maxOutputTokens as number | undefined,
        responseFormat: params.responseFormat as any,
        schema: params.schema,
        apiKey: params.apiKey as string | undefined,
        providerOptions: params.providerOptions as Record<string, unknown> | undefined,
      });
    },
    signature: {
      description: 'Provider-neutral AI generation. Use assign to store text/json output in state.',
      parameters: [
        { name: 'provider', type: 'string', description: 'AI provider id, e.g. mock or openai.', defaultValue: 'mock' },
        { name: 'model', type: 'string', description: 'Provider model id.' },
        { name: 'apiKey', type: 'string', description: 'Provider API key or resolved secret. Not required for mock.' },
        { name: 'system', type: 'string', description: 'System instruction.' },
        { name: 'prompt', type: 'string', description: 'User prompt. If omitted, input/messages are used.' },
        { name: 'messages', type: 'array', description: 'Chat messages with role/content.' },
        { name: 'input', type: 'any', description: 'Input value to serialize into the prompt.' },
        { name: 'temperature', type: 'number', description: 'Sampling temperature.' },
        { name: 'maxOutputTokens', type: 'number', description: 'Maximum generated tokens.' },
        { name: 'responseFormat', type: 'string', description: 'text or json.' },
        { name: 'schema', type: 'object', description: 'Expected JSON schema for structured output.' },
        { name: 'providerOptions', type: 'object', description: 'Provider-specific request options.' },
      ],
      allowAdditionalParameters: false,
      returns: { type: 'object', description: 'AI result containing text/json, usage, model, and optional raw response.' },
    },
  };
}
