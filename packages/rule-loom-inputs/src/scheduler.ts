import type { EventEmitter } from 'node:events';
import Bree from 'bree';
import _ from 'lodash';
import { z } from 'zod';
import type { RuleLoomEngine, ExecutionResult } from 'rule-loom-engine';
import type { RuleLoomLogger } from 'rule-loom-lib';
import type { SchedulerInputConfig, SchedulerJobConfig, RunnerScheduler, SchedulerJobState } from './types.js';
import { registerInputPlugin } from './pluginRegistry.js';

export interface SchedulerInputOptions {
  engine: RuleLoomEngine;
  logger: RuleLoomLogger;
  events: EventEmitter;
}

const schedulerJobSchema = z
  .object({
    name: z.string().min(1),
    flow: z.string().min(1),
    interval: z.union([z.number().positive(), z.string().min(1)]).optional(),
    cron: z.string().min(1).optional(),
    timeout: z.union([z.number().nonnegative(), z.string().min(1), z.boolean()]).optional(),
    initialState: z.record(z.any()).optional(),
    runtime: z.record(z.any()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((job) => job.interval !== undefined || job.cron !== undefined || job.timeout !== undefined, {
    message: 'Scheduler job requires interval, cron, or timeout',
    path: ['interval'],
  });

export const schedulerInputSchema = z.object({
  type: z.literal('scheduler'),
  jobs: z.array(schedulerJobSchema).min(1),
});

registerInputPlugin<SchedulerInputConfig>({
  type: 'scheduler',
  schema: schedulerInputSchema,
  initialize: async (config: SchedulerInputConfig, context) => {
    const scheduler = await createSchedulerInput(config, {
      engine: context.engine,
      logger: context.logger,
      events: context.events,
    });
    return scheduler ? { scheduler } : undefined;
  },
});

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

function createJobDefinitions(jobs: SchedulerJobConfig[]) {
  return jobs.map((job) => {
    const jobCode = buildJobCode(job.name);
    const definition: any = {
      name: job.name,
      path: jobCode,
      worker: {
        eval: true,
        workerData: { name: job.name },
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
  const schedulerJobs = input.jobs.filter((job) => job.enabled !== false);
  if (schedulerJobs.length === 0) return undefined;

  const jobDefinitions = createJobDefinitions(schedulerJobs);
  const jobConfigByName = new Map<string, SchedulerJobConfig>(schedulerJobs.map((job) => [job.name, job]));

  const schedulerJobStates = new Map<string, SchedulerJobState>();
  const breeLogger =
    options.logger && options.logger.info
      ? {
          info: options.logger.info.bind(options.logger),
          warn: options.logger.warn.bind(options.logger),
          error: options.logger.error.bind(options.logger),
        }
      : false;

  const controller = new Bree({
    logger: breeLogger,
    root: false,
    doRootCheck: false,
    jobs: jobDefinitions,
    workerMessageHandler: ({ name, message }) => {
      if (message && typeof message === 'object' && message.type === 'run-flow') {
        const jobConfig = jobConfigByName.get(name);
        if (!jobConfig) return;
        handleJobTrigger(jobConfig, schedulerJobStates, options, name);
      }
    },
  });

  await controller.start();

  return {
    controller,
    jobStates: schedulerJobStates,
    start: () => controller.start(),
    stop: () => controller.stop(),
  };
}

function handleJobTrigger(
  jobConfig: SchedulerJobConfig,
  jobStates: Map<string, SchedulerJobState>,
  options: SchedulerInputOptions,
  name: string,
) {
  const start = process.hrtime.bigint();
  options.logger.info?.(`Scheduler job "${name}" triggered flow "${jobConfig.flow}".`);
  options.events.emit('scheduler:job:started', { job: jobConfig.name, flow: jobConfig.flow });
  const initialState = jobConfig.initialState ? _.cloneDeep(jobConfig.initialState) : {};
  const runtimeContext = {
    ...(jobConfig.runtime ? _.cloneDeep(jobConfig.runtime) : {}),
    scheduler: {
      job: jobConfig.name,
      triggeredAt: new Date().toISOString(),
    },
  };
  options.engine
    .execute(jobConfig.flow, initialState, runtimeContext)
    .then((result: ExecutionResult) => {
      const entry = jobStates.get(name) ?? { runs: 0 };
      entry.runs += 1;
      entry.lastRun = new Date();
      entry.lastResult = result;
      entry.lastError = undefined;
      jobStates.set(name, entry);
      options.logger.info?.(`Scheduler job "${name}" completed successfully.`);
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      options.events.emit('scheduler:job:completed', { job: jobConfig.name, flow: jobConfig.flow, durationSeconds });
    })
    .catch((error: unknown) => {
      const entry = jobStates.get(name) ?? { runs: 0 };
      entry.lastRun = new Date();
      entry.lastError = error;
      jobStates.set(name, entry);
      options.logger.error?.(`Scheduler job "${name}" failed`, error);
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      options.events.emit('scheduler:job:failed', { job: jobConfig.name, flow: jobConfig.flow, durationSeconds });
    });
}
