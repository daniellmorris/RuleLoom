import type { RuleLoomLogger } from 'rule-loom-lib';
import type { ClosureDefinition } from 'rule-loom-engine';
import { createCoreClosures } from './closures.js';
import { createHttpClosures } from './http.js';
import { registerBuiltinInputs } from './inputs/index.js';

type RegisterInput = Parameters<typeof registerBuiltinInputs>[0];

export interface CorePluginContext {
  registerClosure: (closure: ClosureDefinition) => void;
  registerInputPlugin?: RegisterInput;
  logger: RuleLoomLogger;
}

export const corePlugin = {
  name: 'rule-loom-core',
  version: '0.0.0',
  async register({ registerClosure, registerInputPlugin, logger }: CorePluginContext) {
    const closures = [...createCoreClosures(), ...createHttpClosures()];
    closures.forEach((closure) => registerClosure(closure));
    if (registerInputPlugin) {
      registerBuiltinInputs(registerInputPlugin as RegisterInput);
    } else {
      registerBuiltinInputs();
    }
    logger.debug?.('rule-loom-core plugin registered core + http closures');
  },
};

export default corePlugin;
