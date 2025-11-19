import type { Express } from 'express';
import type Bree from 'bree';
import type { ExecutionResult } from 'tree-exe-engine';

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

export type RunnerInputConfig = HttpInputConfig | SchedulerInputConfig | MqttInputConfig | AmqpInputConfig;

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
