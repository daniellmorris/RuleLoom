import { createCoreClosures } from './closures.js';
import { createHttpClosures } from './http.js';
import { registerBuiltinInputs } from './inputs/index.js';
export const corePlugin = {
    name: 'rule-loom-core',
    version: '0.0.0',
    async register({ registerClosure, registerInputPlugin, logger }) {
        const closures = [...createCoreClosures(), ...createHttpClosures()];
        closures.forEach((closure) => registerClosure(closure));
        if (registerInputPlugin) {
            registerBuiltinInputs(registerInputPlugin);
        }
        else {
            registerBuiltinInputs();
        }
        logger.debug?.('rule-loom-core plugin registered core + http closures');
    },
};
export default corePlugin;
//# sourceMappingURL=corePlugin.js.map