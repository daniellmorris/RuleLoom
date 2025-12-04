import type { EventEmitter } from 'node:events';
import Bree from 'bree';
import _ from 'lodash';
import { z } from 'zod';
import type { RuleLoomEngine, ExecutionResult } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type {
  SchedulerInputConfig,
  SchedulerTriggerConfig,
  RunnerScheduler,
  SchedulerJobState,
  InputPlugin,
} from './types.js';

export interface SchedulerInputOptions {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  events: EventEmitter;
}

export const schedulerConfigParameters: any[] = [];
export const schedulerTriggerParameters = [
  { name: 'name', type: 'string', required: false, description: 'Friendly job name' },
  { name: 'flow', type: 'string', required: true, description: 'Flow to run' },
  { name: 'interval', type: 'string', required: false, description: 'Interval expression or ms' },
  { name: 'cron', type: 'string', required: false, description: 'Cron expression' },
  { name: 'timeout', type: 'string', required: false, description: 'Timeout or delay' },
  { name: 'initialState', type: 'any', required: false },
  { name: 'runtime', type: 'any', required: false },
  { name: 'enabled', type: 'boolean', required: false },
];

function buildSchedulerSchema() {
  const toZod = (p: any) => {
    switch (p.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      default:
        return z.any();
    }
  };
  const triggerShape: Record<string, any> = { id: z.string().optional(), type: z.enum(['cron', 'interval', 'timeout']).optional() };
  schedulerTriggerParameters.forEach((p) => {
    triggerShape[p.name] = p.required ? toZod(p) : toZod(p).optional();
  });
  return z.object({
    type: z.literal('scheduler'),
    triggers: z.array(z.object(triggerShape).refine((job) => job.interval !== undefined || job.cron !== undefined || job.timeout !== undefined, {
      message: 'Scheduler trigger requires interval, cron, or timeout',
      path: ['interval'],
    })).min(1),
  });
}

export const schedulerInputSchema = buildSchedulerSchema();

export const schedulerInputPlugin: InputPlugin<SchedulerInputConfig> = {
  type: 'scheduler',
  schema: schedulerInputSchema,
  configParameters: schedulerConfigParameters,
  triggerParameters: schedulerTriggerParameters,
  initialize: async (config: SchedulerInputConfig, context) => {
    const scheduler = await createSchedulerInput(config, {
      engine: context.engine,
      logger: context.logger,
      events: context.events,
    });
    return scheduler ? { scheduler } : undefined;
  },
};

function buildJobCode(jobName: string) {
  return `(() => {
  const { parentPort, workerData } = require('node:worker_threads');
  const jobName = (workerData && workerData.name) || ${JSON.stringify(jobName)};
  if (parentPort) {
    parentPort.postMessage({ type: 'run-flow', name: jobName });
    parentPort.postMessage('done');
  }
})()`;
}

function createJobDefinitions(triggers: SchedulerTriggerConfig[]) {
  return triggers.map((job, idx) => {
    const name = job.name ?? job.id ?? `job-${idx + 1}`;
    const jobCode = buildJobCode(name);
    const definition: any = {
      name,
      path: jobCode,
      worker: {
        eval: true,
        workerData: { name },
      },
    };
    if (job.interval !== undefined) definition.interval = job.interval;
    if (job.cron !== undefined) definition.cron = job.cron;
    if (job.timeout !== undefined) definition.timeout = job.timeout;
    return definition;
  });
}

export async function createSchedulerInput(
  input: SchedulerInputConfig,
  options: SchedulerInputOptions,
): Promise<RunnerScheduler | undefined> {
  if (!input.triggers?.length) return undefined;

  const bree = await createBree(input, options);
  return startScheduler(bree, options.logger);
}

async function createBree(input: SchedulerInputConfig, options: SchedulerInputOptions) {
  const definitions = createJobDefinitions(input.triggers);
  const bree = new Bree({
    root: false,
    jobs: definitions,
    workerMessageHandler: async (message: any) => {
      if (message?.type === 'run-flow') {
        const flowName = message.name as string;
        const jobConfig = input.triggers.find((job) => (job.name ?? job.id) === flowName);
        if (!jobConfig) return;
        const state = _.cloneDeep(jobConfig.initialState ?? {});
        const runtime = _.cloneDeep(jobConfig.runtime ?? {});
        _.set(runtime, 'scheduler.job', jobConfig.name);
        _.set(runtime, 'scheduler.triggeredAt', new Date().toISOString());
        await options.engine.execute(flowName, state, runtime);
      }
    },
  });
  return bree as unknown as SchedulerInternal;
}

async function startScheduler(bree: SchedulerInternal, logger: RuleLoomLogger): Promise<RunnerScheduler> {
  const jobStates = new Map<string, SchedulerJobState>();

  bree.on('worker created', (name: string) => {
    const state = jobStates.get(name) ?? { runs: 0 };
    state.runs += 1;
    state.lastRun = new Date();
    jobStates.set(name, state);
  });

  bree.on('worker message', (name: string, message: any) => {
    const state = jobStates.get(name) ?? { runs: 0 };
    if (message?.type === 'run-flow') return;
    if (message === 'done') return;
    state.lastResult = message as ExecutionResult;
    jobStates.set(name, state);
  });

  bree.on('worker error', (name: string, error: unknown) => {
    const state = jobStates.get(name) ?? { runs: 0 };
    state.lastError = error;
    jobStates.set(name, state);
    logger.error?.('Scheduler job error', { name, error });
  });

  await bree.start();

  return {
    jobStates,
    stop: async () => {
      await bree.stop();
    },
  };
}

type SchedulerInternal = Bree & EventEmitter;
