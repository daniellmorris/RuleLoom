import type { Express } from 'express';
import type Bree from 'bree';
import type { EventEmitter } from 'node:events';
import type RuleLoomEngine from 'rule-loom-engine';
import type { ExecutionResult } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface HttpRouteRespondWith {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface HttpRouteConfig {
  id?: string;
  method?: HttpMethod;
  path: string;
  flow: string;
  respondWith?: HttpRouteRespondWith;
}

export interface HttpInputConfig {
  type: 'http';
  id?: string;
  basePath?: string;
  bodyLimit?: string | number;
  routes: HttpRouteConfig[];
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

export interface SchedulerInputConfig {
  type: 'scheduler';
  jobs: SchedulerJobConfig[];
}

export interface MqttInputConfig {
  type: 'mqtt';
  name?: string;
  options?: Record<string, unknown>;
}

export interface AmqpInputConfig {
  type: 'amqp';
  name?: string;
  options?: Record<string, unknown>;
}

export interface InitInputConfig {
  type: 'init';
  flow: string;
  initialState?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
}

export type RunnerInputConfig =
  | HttpInputConfig
  | SchedulerInputConfig
  | MqttInputConfig
  | AmqpInputConfig
  | InitInputConfig;

export interface InputPluginContext {
  logger: RuleLoomLogger;
  engine: RuleLoomEngine;
  metadata?: Record<string, unknown>;
  events: EventEmitter;
}

export interface InputInitResult {
  http?: {
    app: HttpInputApp;
    basePath?: string;
  };
  scheduler?: RunnerScheduler;
  cleanup?: () => Promise<void> | void;
}

export interface BaseInputConfig {
  type: string;
}

export interface InputPlugin<Config extends BaseInputConfig = RunnerInputConfig> {
  type: string;
  schema: import('zod').ZodType<Config>;
  initialize: (config: Config, context: InputPluginContext) => Promise<InputInitResult | void> | InputInitResult | void;
}

export interface SchedulerJobState {
  runs: number;
  lastRun?: Date;
  lastResult?: ExecutionResult;
  lastError?: unknown;
}

export interface RunnerScheduler {
  controller: Bree;
  jobStates: Map<string, SchedulerJobState>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export type HttpInputApp = Express;
