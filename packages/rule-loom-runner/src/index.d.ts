import http from 'node:http';
import { EventEmitter } from 'node:events';
import RuleLoomEngine from 'rule-loom-engine';
import { type RuleLoomLogger } from 'rule-loom-lib';
import { type RunnerConfig } from './config.js';
import { type HttpInputApp, type RunnerScheduler } from 'rule-loom-core/inputs';
import { type ValidationResult } from './validator.js';
export interface RunnerInstance {
    engine: RuleLoomEngine;
    logger: RuleLoomLogger;
    config: RunnerConfig;
    configPath: string;
    app: HttpInputApp;
    listen: (port?: number, host?: string) => Promise<http.Server>;
    close: () => Promise<void>;
    scheduler?: RunnerScheduler;
    events: EventEmitter;
}
export interface StartOptions {
    configPath: string;
    portOverride?: number;
    host?: string;
}
export declare function createRunner(configPath: string): Promise<RunnerInstance>;
export declare function startRunner(options: StartOptions): Promise<{
    instance: RunnerInstance;
    server: http.Server;
}>;
export declare function validateConfig(configPath: string): Promise<ValidationResult>;
export { getHttpInput, getSchedulerInput } from './config.js';
export type { RunnerConfig, RunnerConfigWithMeta } from './config.js';
export type { RunnerScheduler, SchedulerJobConfig, SchedulerInputConfig, HttpInputConfig } from 'rule-loom-core/inputs';
export { RunnerValidationError } from './validator.js';
export type { ValidationIssue, ValidationResult } from './validator.js';
export type { PluginRegistrationContext, RuleLoomPlugin } from './pluginLoader.js';
export { generateManifest, readManifest, type RuleLoomManifest } from './manifest.js';
//# sourceMappingURL=index.d.ts.map