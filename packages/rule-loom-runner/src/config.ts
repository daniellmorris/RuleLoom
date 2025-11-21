import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { LogLevel } from 'rule-loom-lib';
import type {
  HttpInputConfig,
  SchedulerInputConfig,
  SchedulerJobConfig,
  RunnerInputConfig,
} from 'rule-loom-inputs';
import { getInputSchema } from 'rule-loom-inputs';
import { logLevelSchema, flowSchema, templateClosureSchema, moduleClosureSchema, flowClosureSchema } from './schemas.js';
import { pluginSpecSchema } from './pluginSpecs.js';

export type FlowConfig = z.infer<typeof flowSchema>;

const closureSchema = z.union([templateClosureSchema, moduleClosureSchema, flowClosureSchema]);

export type ClosureConfig = z.infer<typeof closureSchema>;

export function createRunnerConfigSchema() {
  const inputSchema = getInputSchema();

  return z
    .object({
      version: z.number().int().positive().optional().default(1),
      logger: z
        .object({
          level: logLevelSchema.optional(),
        })
        .optional(),
      metadata: z.record(z.any()).optional(),
      plugins: z.array(pluginSpecSchema).optional().default([]),
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
}

export type RunnerConfig = z.infer<ReturnType<typeof createRunnerConfigSchema>>;

export interface RunnerConfigWithMeta {
  config: RunnerConfig;
  rawConfig: unknown;
  configPath: string;
  configDir: string;
}

export function parseRunnerConfig(rawConfig: unknown): RunnerConfig {
  const schema = createRunnerConfigSchema();
  return schema.parse(rawConfig);
}

export function getHttpInput(config: RunnerConfig): HttpInputConfig | undefined {
  const entry = config.inputs.find((input) => input.type === 'http');
  return entry?.type === 'http' ? (entry as HttpInputConfig) : undefined;
}

export function getSchedulerInput(config: RunnerConfig): SchedulerInputConfig | undefined {
  const entry = config.inputs.find((input) => input.type === 'scheduler');
  return entry?.type === 'scheduler' ? (entry as SchedulerInputConfig) : undefined;
}

export async function readRunnerConfigFile(configPath: string): Promise<RunnerConfigWithMeta> {
  const absolutePath = path.resolve(configPath);
  const file = await fs.readFile(absolutePath, 'utf8');
  const parsed = (yaml.load(file) ?? {}) as Record<string, unknown>;
  return {
    config: parsed as RunnerConfig,
    rawConfig: parsed,
    configPath: absolutePath,
    configDir: path.dirname(absolutePath),
  };
}

export async function importClosureModule(modulePath: string, baseDir: string) {
  const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(baseDir, modulePath);
  return import(pathToFileURL(resolved).href);
}
