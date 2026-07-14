import type { AiProvider, EmbedRequest, EmbedResult, GenerateRequest, GenerateResult } from './types.js';

function buildMessages(request: GenerateRequest) {
  if (request.messages?.length) return request.messages;
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (request.system) messages.push({ role: 'system', content: request.system });
  const content =
    request.prompt ??
    (typeof request.input === 'string' ? request.input : request.input === undefined ? '' : JSON.stringify(request.input));
  messages.push({ role: 'user', content });
  return messages;
}

function requireApiKey(request: { apiKey?: string }) {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new Error('OpenAI provider requires "apiKey" or a resolved secret value.');
  }
  return apiKey;
}

export const openAiProvider: AiProvider = {
  name: 'openai',
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: requireApiKey(request) });
    const wantsJson = request.responseFormat === 'json' || !!request.schema;
    const res = await client.chat.completions.create({
      model: request.model ?? 'gpt-4o-mini',
      messages: buildMessages(request),
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      response_format: wantsJson ? { type: 'json_object' } : undefined,
      ...(request.providerOptions ?? {}),
    } as any);
    const text = res.choices?.[0]?.message?.content ?? '';
    let json: unknown;
    if (wantsJson && text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return { text, json, usage: res.usage, model: res.model, raw: res };
  },
  async embed(request: EmbedRequest): Promise<EmbedResult> {
    const { OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: requireApiKey(request) });
    const res = await client.embeddings.create({
      model: request.model ?? 'text-embedding-3-small',
      input: request.input,
      ...(request.providerOptions ?? {}),
    } as any);
    return {
      embeddings: res.data.map((item) => item.embedding),
      usage: res.usage,
      model: res.model,
      raw: res,
    };
  },
};
