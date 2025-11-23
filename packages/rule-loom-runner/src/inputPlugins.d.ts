import type RuleLoomEngine from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { HttpInputApp, RunnerInputConfig, RunnerScheduler } from 'rule-loom-core/inputs';
import type { EventEmitter } from 'node:events';
export interface InitializedInputs {
    httpApp?: HttpInputApp;
    scheduler?: RunnerScheduler;
    cleanup: () => Promise<void>;
}
export declare function initializeInputs(inputs: RunnerInputConfig[], engine: RuleLoomEngine, logger: RuleLoomLogger, metadata: Record<string, unknown> | undefined, events: EventEmitter): Promise<InitializedInputs>;
//# sourceMappingURL=inputPlugins.d.ts.map