import type { RuleLoomEngine } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { EventEmitter } from 'node:events';

export interface BaseInputConfig {
  type: string;
  id?: string;
  config?: Record<string, unknown>;
}

export interface InputPluginContext {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  metadata?: Record<string, unknown>;
  events: EventEmitter;
}

export interface InputPluginResult {
  cleanup?: () => void | Promise<void>;
  services?: Record<string, unknown>;
}

export interface InputPlugin<Config extends BaseInputConfig = BaseInputConfig> {
  type: Config['type'];
  schema: any; // z.ZodType but keep loose to avoid circular deps in plain JS build
  configParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; enum?: string[]; properties?: any; items?: any }>;
  triggerParameters?: Array<{ name: string; type?: string; required?: boolean; description?: string; enum?: string[]; properties?: any; items?: any }>;
  initialize: (config: Config, context: InputPluginContext) => Promise<InputPluginResult | void> | InputPluginResult | void;
}

export interface InitTriggerConfig {
  id?: string;
  type?: 'init';
  flow: string;
  initialState?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
}

export interface InitInputConfig extends BaseInputConfig {
  type: 'init';
  triggers: InitTriggerConfig[];
}

export type RunnerInputConfig = InitInputConfig;
