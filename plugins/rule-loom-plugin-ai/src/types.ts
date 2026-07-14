export type AiClosureDefinition = {
  namespace?: string;
  version?: string;
  name: string;
  description?: string;
  capabilities?: Array<'pure' | 'network' | 'database' | 'filesystem' | 'message' | 'process'>;
  handler: (state: Record<string, unknown>, context: { parameters?: Record<string, unknown>; state: Record<string, unknown>; runtime: Record<string, unknown> }) => unknown | Promise<unknown>;
  signature?: Record<string, unknown>;
};
