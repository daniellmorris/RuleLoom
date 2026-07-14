import type { AiProvider, EmbedRequest, EmbedResult, GenerateRequest, GenerateResult } from './types.js';

function renderInput(request: GenerateRequest): string {
  if (typeof request.prompt === 'string') return request.prompt;
  if (typeof request.input === 'string') return request.input;
  if (request.input !== undefined) return JSON.stringify(request.input);
  if (request.messages?.length) return request.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  return '';
}

function mockJsonFromSchema(schema: unknown, fallback: string): unknown {
  if (!schema || typeof schema !== 'object') return { text: fallback };
  const record = schema as any;
  if (record.type === 'object' && record.properties && typeof record.properties === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, descriptor] of Object.entries(record.properties as Record<string, any>)) {
      if (Array.isArray(descriptor.enum) && descriptor.enum.length) {
        out[key] = descriptor.enum[0];
      } else if (descriptor.type === 'number' || descriptor.type === 'integer') {
        out[key] = 0;
      } else if (descriptor.type === 'boolean') {
        out[key] = false;
      } else if (descriptor.type === 'array') {
        out[key] = [];
      } else if (descriptor.type === 'object') {
        out[key] = {};
      } else {
        out[key] = `mock-${key}`;
      }
    }
    return out;
  }
  return { text: fallback };
}

function embedText(text: string): number[] {
  const seed = Array.from(text).reduce((acc, ch) => (acc + ch.charCodeAt(0)) % 997, 0);
  return [seed / 997, text.length / 1000, (text.split(/\s+/).filter(Boolean).length % 100) / 100];
}

export const mockProvider: AiProvider = {
  name: 'mock',
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const text = `mock:${renderInput(request)}`;
    if (request.responseFormat === 'json' || request.schema) {
      return {
        json: mockJsonFromSchema(request.schema, text),
        text,
        model: request.model ?? 'mock',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }
    return {
      text,
      model: request.model ?? 'mock',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  },
  async embed(request: EmbedRequest): Promise<EmbedResult> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    return {
      embeddings: inputs.map(embedText),
      model: request.model ?? 'mock-embedding',
      usage: { inputTokens: 0 },
    };
  },
};
