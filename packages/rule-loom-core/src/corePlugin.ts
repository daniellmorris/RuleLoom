import type { RuleLoomLogger } from 'rule-loom-lib';
import type { ClosureDefinition } from 'rule-loom-engine';
import { createCoreClosures } from './closures.js';
import { createHttpClosures } from './http.js';

export interface CorePluginContext {
  registerClosure: (closure: ClosureDefinition) => void;
  logger: RuleLoomLogger;
}

export const corePlugin = {
  name: 'rule-loom-core',
  version: '0.0.0',
  async register({ registerClosure, logger }: CorePluginContext) {
    const closures = [...createCoreClosures(), ...createHttpClosures()];
    closures.forEach((closure) => registerClosure(closure));
    logger.debug?.('rule-loom-core plugin registered core + http closures');
  },
};

export default corePlugin;
