export type AiProviderName = 'mock' | 'openai' | string;

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type GenerateRequest = {
  model?: string;
  system?: string;
  prompt?: string;
  messages?: AiMessage[];
  input?: unknown;
  temperature?: number;
  maxOutputTokens?: number;
  responseFormat?: 'text' | 'json';
  schema?: unknown;
  apiKey?: string;
  providerOptions?: Record<string, unknown>;
};

export type GenerateResult = {
  text?: string;
  json?: unknown;
  usage?: unknown;
  model?: string;
  raw?: unknown;
};

export type EmbedRequest = {
  model?: string;
  input: string | string[];
  apiKey?: string;
  providerOptions?: Record<string, unknown>;
};

export type EmbedResult = {
  embeddings: number[][];
  usage?: unknown;
  model?: string;
  raw?: unknown;
};

export interface AiProvider {
  name: AiProviderName;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  embed?(request: EmbedRequest): Promise<EmbedResult>;
}
