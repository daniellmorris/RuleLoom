import type { RuleLoomLogger } from 'rule-loom-lib';
import type { ClosureDefinition } from 'rule-loom-engine';
import { createCoreClosures } from './closures.js';
import { registerBuiltinInputs } from './inputs/index.js';
export interface CorePluginContext {
  registerClosure: (closure: ClosureDefinition) => void;
  registerInputPlugin?: (plugin: any) => void;
  logger: RuleLoomLogger;
}

export const corePlugin = {
  name: 'rule-loom-core',
  version: '0.0.0',
  async register({ registerClosure, registerInputPlugin, logger }: CorePluginContext) {
    const closures = [...createCoreClosures()];
    closures.forEach((closure) => registerClosure(closure));
    if (registerInputPlugin) {
      registerBuiltinInputs(registerInputPlugin as any);
    }
    logger.debug?.('rule-loom-core plugin registered core closures');
  },
};

export default corePlugin;
