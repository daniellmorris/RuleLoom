import { aiClassifyClosure } from './closures/classify.js';
import { aiEmbedClosure } from './closures/embed.js';
import { aiExtractClosure } from './closures/extract.js';
import { aiGenerateClosure } from './closures/generate.js';
import type { AiClosureDefinition } from './types.js';

type AiPluginRegistrationContext = {
  registerClosure: (closure: AiClosureDefinition) => void;
  logger: {
    debug?: (...args: unknown[]) => void;
  };
};

export const plugin = {
  name: 'rule-loom-plugin-ai',
  version: '0.1.0',
  async register(ctx: AiPluginRegistrationContext) {
    [
      aiGenerateClosure(),
      aiExtractClosure(),
      aiClassifyClosure(),
      aiEmbedClosure(),
    ].forEach((closure) => ctx.registerClosure(closure));
    ctx.logger.debug?.('rule-loom-plugin-ai registered provider-neutral AI closures');
  },
};

export default plugin;
export * from './providers/index.js';
export { aiGenerateClosure } from './closures/generate.js';
export { aiExtractClosure } from './closures/extract.js';
export { aiClassifyClosure } from './closures/classify.js';
export { aiEmbedClosure } from './closures/embed.js';
