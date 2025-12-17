import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import type { LogLevel } from 'rule-loom-lib';
import type { BaseInputConfig } from './pluginApi.js';
import { getInputSchema } from './pluginApi.js';
import { logLevelSchema, flowSchema, templateClosureSchema, moduleClosureSchema, flowClosureSchema } from './schemas.js';
import { pluginSpecSchema } from './pluginSpecs.js';
import { applySecrets, resolveSecrets, type SecretsConfig, type SecretMap } from './secrets.js';

export type FlowConfig = z.infer<typeof flowSchema>;

export const closureSchema = z.union([templateClosureSchema, moduleClosureSchema, flowClosureSchema]);

export type ClosureConfig = z.infer<typeof closureSchema>;

export function parseClosureConfigs(raw: unknown): ClosureConfig[] {
  if (raw === undefined || raw === null) return [];
  return z.array(closureSchema).parse(raw);
}

export function createRunnerConfigSchema() {
  const inputSchema = getInputSchema();

  const secretsSchema = z
    .object({
      inline: z.record(z.string()).optional(),
      env: z.record(z.string()).optional(),
      files: z
        .array(
          z.object({
            key: z.string().min(1),
            path: z.string().min(1),
            encoding: z.string().optional(),
          }),
        )
        .optional(),
      dotenv: z
        .object({
          path: z.string().optional(),
          encoding: z.string().optional(),
          required: z.boolean().optional(),
        })
        .optional(),
    })
    .optional();

  return z.object({
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
    secrets: secretsSchema,
    flows: z.array(flowSchema).min(1),
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
