import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { FlowDefinition, FlowInvokeStep, FlowBranchStep } from 'rule-loom-engine';
import type { LogLevel } from 'rule-loom-lib';
import type {
  HttpRouteConfig,
  HttpInputConfig,
  SchedulerInputConfig,
  SchedulerJobConfig,
  RunnerInputConfig,
  AmqpInputConfig,
  MqttInputConfig,
} from 'rule-loom-inputs';

const logLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']) as z.ZodType<LogLevel>;

const conditionSchema = z.object({
  closure: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  negate: z.boolean().optional(),
});

const whenSchema = z.union([conditionSchema, z.array(conditionSchema)]);

let flowStepSchema: z.ZodType<FlowDefinition['steps'][number]>;

const invokeStepSchema = z
  .object({
    type: z.literal('invoke').optional(),
    closure: z.string().min(1),
    parameters: z.record(z.any()).optional(),
    assign: z.string().min(1).optional(),
    mergeResult: z.boolean().optional(),
    when: whenSchema.optional(),
  })
  .passthrough()
  .transform((step) => {
    const { type, closure, parameters, assign, mergeResult, when, ...rest } = step as any;
    const computedParams: Record<string, unknown> = { ...(parameters ?? {}) };

    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined) continue;
      if (key === 'steps') {
        computedParams.steps = flowStepSchema.array().parse(value);
      } else {
        computedParams[key] = value;
      }
    }

    return {
      type: 'invoke' as const,
      closure,
      parameters: Object.keys(computedParams).length ? computedParams : undefined,
      assign,
      mergeResult,
      when,
    } satisfies FlowInvokeStep;
  });

const branchCaseSchema = z.object({
  when: whenSchema,
  steps: z.lazy(() => flowStepSchema.array().min(1)),
});

const rawBranchStepSchema = z.object({
  type: z.literal('branch').optional(),
  cases: z.array(branchCaseSchema).min(1),
  otherwise: z.lazy(() => flowStepSchema.array()).optional(),
}).superRefine((value, ctx) => {
  if ('closure' in (value as Record<string, unknown>)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Branch steps cannot specify "closure".',
    });
  }
});

const branchStepSchema = rawBranchStepSchema.transform((step) => ({
  type: 'branch' as const,
  cases: step.cases,
  otherwise: step.otherwise,
})) as unknown as z.ZodType<FlowBranchStep>;

flowStepSchema = z.union([
  invokeStepSchema as unknown as z.ZodType<FlowInvokeStep>,
  branchStepSchema,
]) as unknown as z.ZodType<FlowDefinition['steps'][number]>;

const flowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(flowStepSchema).min(1),
}) satisfies z.ZodType<FlowDefinition>;

export type FlowConfig = z.infer<typeof flowSchema>;

const templateClosureSchema = z
  .object({
    type: z.literal('template'),
    template: z.enum(['set-state', 'respond']),
    name: z.string().min(1),
    description: z.string().optional(),
    options: z.record(z.any()).optional(),
  })
  .and(
    z.discriminatedUnion('template', [
      z.object({
        template: z.literal('set-state'),
        target: z.string().min(1),
        value: z.any().optional(),
        merge: z.boolean().optional().default(false),
      }),
      z.object({
        template: z.literal('respond'),
        status: z.number().int().optional().default(200),
        body: z.any().optional(),
        headers: z.record(z.string()).optional(),
      }),
    ]),
  );

const moduleClosureSchema = z.object({
  type: z.literal('module'),
  name: z.string().optional(),
  description: z.string().optional(),
  module: z.string().min(1),
  export: z.string().optional(),
  config: z.any().optional(),
});

const flowClosureSchema = z.object({
  type: z.literal('flow'),
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(flowStepSchema).min(1),
});

const bundleClosureSchema = z.object({
  type: z.literal('bundle'),
  preset: z.string().min(1),
  options: z.record(z.any()).optional(),
});

const closureSchema = z.union([templateClosureSchema, moduleClosureSchema, flowClosureSchema, bundleClosureSchema]);

export type ClosureConfig = z.infer<typeof closureSchema>;

const schedulerJobSchema = z
  .object({
    name: z.string().min(1),
    flow: z.string().min(1),
    interval: z.union([z.number().positive(), z.string().min(1)]).optional(),
    cron: z.string().min(1).optional(),
    timeout: z.union([z.number().nonnegative(), z.string().min(1), z.boolean()]).optional(),
    initialState: z.record(z.any()).optional(),
    runtime: z.record(z.any()).optional(),
    enabled: z.boolean().optional().default(true),
  })
  .refine((job) => job.interval !== undefined || job.cron !== undefined || job.timeout !== undefined, {
    message: 'Scheduler job requires interval, cron, or timeout',
    path: ['interval'],
  }) satisfies z.ZodType<SchedulerJobConfig>;

const schedulerInputSchema = z
  .object({
    type: z.literal('scheduler'),
    jobs: z.array(schedulerJobSchema).min(1),
  }) satisfies z.ZodType<SchedulerInputConfig>;

const mqttInputSchema = z
  .object({
    type: z.literal('mqtt'),
    name: z.string().optional(),
    options: z.record(z.any()).optional(),
  })
  .passthrough() satisfies z.ZodType<MqttInputConfig>;

const amqpInputSchema = z
  .object({
    type: z.literal('amqp'),
    name: z.string().optional(),
    options: z.record(z.any()).optional(),
  })
  .passthrough() satisfies z.ZodType<AmqpInputConfig>;

const httpRouteSchema = z
  .object({
    id: z.string().optional(),
    method: z.enum(['get', 'post', 'put', 'patch', 'delete']).default('post'),
    path: z.string().min(1),
    flow: z.string().min(1),
    respondWith: z
      .object({
        status: z.number().int().optional(),
        headers: z.record(z.string()).optional(),
        body: z.any().optional(),
      })
      .optional(),
  }) satisfies z.ZodType<HttpRouteConfig>;

const httpInputSchema = z
  .object({
    type: z.literal('http'),
    id: z.string().optional(),
    basePath: z.string().optional().default('/'),
    bodyLimit: z.union([z.number(), z.string()]).optional().default('1mb'),
    routes: z.array(httpRouteSchema).min(1),
  }) satisfies z.ZodType<HttpInputConfig>;

const inputSchema = z.discriminatedUnion('type', [httpInputSchema, schedulerInputSchema, mqttInputSchema, amqpInputSchema]);

const runnerConfigSchema = z
  .object({
    version: z.number().int().positive().optional().default(1),
    logger: z
      .object({
        level: logLevelSchema.optional(),
      })
      .optional(),
    metadata: z.record(z.any()).optional(),
    inputs: z.array(inputSchema).optional().default([]),
    closures: z.array(closureSchema).optional().default([]),
    flows: z.array(flowSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const httpInputs = value.inputs.filter((input) => input.type === 'http');
    if (httpInputs.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only a single HTTP input is currently supported per runner.',
        path: ['inputs'],
      });
    }
  });

export type RunnerConfig = z.infer<typeof runnerConfigSchema>;

export interface RunnerConfigWithMeta {
  config: RunnerConfig;
  configPath: string;
  configDir: string;
}

export function getHttpInput(config: RunnerConfig): HttpInputConfig | undefined {
  const entry = config.inputs.find((input) => input.type === 'http');
  return entry?.type === 'http' ? (entry as HttpInputConfig) : undefined;
}

export function getSchedulerInput(config: RunnerConfig): SchedulerInputConfig | undefined {
  const entry = config.inputs.find((input) => input.type === 'scheduler');
  return entry?.type === 'scheduler' ? (entry as SchedulerInputConfig) : undefined;
}

export async function loadRunnerConfig(configPath: string): Promise<RunnerConfigWithMeta> {
  const absolutePath = path.resolve(configPath);
  const file = await fs.readFile(absolutePath, 'utf8');
  const parsed = (yaml.load(file) ?? {}) as Record<string, unknown>;
  const config = runnerConfigSchema.parse(parsed);
  return {
    config,
    configPath: absolutePath,
    configDir: path.dirname(absolutePath),
  };
}

export async function importClosureModule(modulePath: string, baseDir: string) {
  const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(baseDir, modulePath);
  return import(pathToFileURL(resolved).href);
}
