import type { RuleLoomLogger } from 'rule-loom-lib';
import type { ClosureDefinition } from 'rule-loom-engine';
import { registerBuiltinInputs } from './inputs/index.js';
type RegisterInput = Parameters<typeof registerBuiltinInputs>[0];
export interface CorePluginContext {
    registerClosure: (closure: ClosureDefinition) => void;
    registerInputPlugin?: RegisterInput;
    logger: RuleLoomLogger;
}
export declare const corePlugin: {
    name: string;
    version: string;
    register({ registerClosure, registerInputPlugin, logger }: CorePluginContext): Promise<void>;
};
export default corePlugin;
//# sourceMappingURL=corePlugin.d.ts.map