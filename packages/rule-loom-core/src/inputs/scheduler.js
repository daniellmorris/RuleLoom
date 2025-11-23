import Bree from 'bree';
import _ from 'lodash';
import { z } from 'zod';
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
export const schedulerInputPlugin = {
    type: 'scheduler',
    schema: schedulerInputSchema,
    initialize: async (config, context) => {
        const scheduler = await createSchedulerInput(config, {
            engine: context.engine,
            logger: context.logger,
            events: context.events,
        });
        return scheduler ? { scheduler } : undefined;
    },
};
function buildJobCode(jobName) {
    return `(() => {
  const { parentPort, workerData } = require('node:worker_threads');
  const jobName = (workerData && workerData.name) || ${JSON.stringify(jobName)};
  if (parentPort) {
    parentPort.postMessage({ type: 'run-flow', name: jobName });
    parentPort.postMessage('done');
  }
})()`;
}
function createJobDefinitions(jobs) {
    return jobs.map((job) => {
        const jobCode = buildJobCode(job.name);
        const definition = {
            name: job.name,
            path: jobCode,
            worker: {
                eval: true,
                workerData: { name: job.name },
            },
        };
        if (job.interval !== undefined)
            definition.interval = job.interval;
        if (job.cron !== undefined)
            definition.cron = job.cron;
        if (job.timeout !== undefined)
            definition.timeout = job.timeout;
        return definition;
    });
}
export async function createSchedulerInput(input, options) {
    if (!input.jobs?.length)
        return undefined;
    const bree = await createBree(input, options);
    return startScheduler(bree, options.logger);
}
async function createBree(input, options) {
    const definitions = createJobDefinitions(input.jobs);
    const bree = new Bree({
        root: false,
        jobs: definitions,
        workerMessageHandler: async (message) => {
            if (message?.type === 'run-flow') {
                const flowName = message.name;
                const jobConfig = input.jobs.find((job) => job.name === flowName);
                if (!jobConfig)
                    return;
                const state = _.cloneDeep(jobConfig.initialState ?? {});
                const runtime = _.cloneDeep(jobConfig.runtime ?? {});
                _.set(runtime, 'scheduler.job', jobConfig.name);
                _.set(runtime, 'scheduler.triggeredAt', new Date().toISOString());
                await options.engine.execute(flowName, state, runtime);
            }
        },
    });
    return bree;
}
async function startScheduler(bree, logger) {
    const jobStates = new Map();
    bree.on('worker created', (name) => {
        const state = jobStates.get(name) ?? { runs: 0 };
        state.runs += 1;
        state.lastRun = new Date();
        jobStates.set(name, state);
    });
    bree.on('worker message', (name, message) => {
        const state = jobStates.get(name) ?? { runs: 0 };
        if (message?.type === 'run-flow')
            return;
        if (message === 'done')
            return;
        state.lastResult = message;
        jobStates.set(name, state);
    });
    bree.on('worker error', (name, error) => {
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
//# sourceMappingURL=scheduler.js.map