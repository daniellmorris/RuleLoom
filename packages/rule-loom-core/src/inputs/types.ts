import type { RuleLoomEngine, ExecutionResult } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { EventEmitter } from 'node:events';

export interface BaseInputConfig {
  type: string;
  id?: string;
}

export interface InputPluginContext {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  metadata?: Record<string, unknown>;
  events: EventEmitter;
}

export interface InputPluginResult {
  cleanup?: () => void | Promise<void>;
  http?: { app: unknown; basePath: string };
  scheduler?: RunnerScheduler;
}

export interface InputPlugin<Config extends BaseInputConfig = BaseInputConfig> {
  type: Config['type'];
  schema: any; // z.ZodType but keep loose to avoid circular deps in plain JS build
  initialize: (config: Config, context: InputPluginContext) => Promise<InputPluginResult | void> | InputPluginResult | void;
}

export interface HttpRouteRespondWith {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpRouteConfig {
  id?: string;
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  flow: string;
  respondWith?: HttpRouteRespondWith;
}

export interface HttpInputConfig extends BaseInputConfig {
  type: 'http';
  basePath?: string;
  bodyLimit?: string | number;
  routes: HttpRouteConfig[];
}

export type HttpInputApp = any; // Express app, but keep loose to avoid dependency typing

export interface InitInputConfig extends BaseInputConfig {
  type: 'init';
  flow: string;
  initialState?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
}

export interface SchedulerJobConfig {
  name: string;
  flow: string;
  interval?: number | string;
  cron?: string;
  timeout?: number | string | boolean;
  initialState?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  enabled?: boolean;
}

export interface SchedulerJobState {
  runs: number;
  lastRun?: Date;
  lastResult?: ExecutionResult;
  lastError?: unknown;
}

export interface RunnerScheduler {
  jobStates: Map<string, SchedulerJobState>;
  stop: () => Promise<void>;
}

export interface SchedulerInputConfig extends BaseInputConfig {
  type: 'scheduler';
  jobs: SchedulerJobConfig[];
}

export type RunnerInputConfig =
  | HttpInputConfig
  | SchedulerInputConfig
  | InitInputConfig
  | MqttInputConfig
  | AmqpInputConfig;

export interface MqttInputConfig extends BaseInputConfig {
  type: 'mqtt';
  options?: Record<string, unknown>;
}

export interface AmqpInputConfig extends BaseInputConfig {
  type: 'amqp';
  options?: Record<string, unknown>;
}
