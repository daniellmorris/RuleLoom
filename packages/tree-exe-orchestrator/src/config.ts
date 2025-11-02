import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';

const runnerEntrySchema = z.object({
  name: z.string().optional(),
  config: z.string().min(1),
  basePath: z.string().optional(),
});

const orchestratorConfigSchema = z.object({
  version: z.number().int().positive().optional().default(1),
  logger: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
    })
    .optional(),
  server: z.object({
    port: z.number().int().min(1).max(65535).default(8080),
    basePath: z.string().optional(),
  }),
  runners: z.array(runnerEntrySchema).optional().default([]),
});

export type OrchestratorConfig = z.infer<typeof orchestratorConfigSchema>;

export async function loadOrchestratorConfig(configPath: string): Promise<OrchestratorConfig> {
  const absolute = path.resolve(configPath);
  const contents = await fs.readFile(absolute, 'utf8');
  const parsed = (yaml.load(contents) ?? {}) as Record<string, unknown>;
  const config = orchestratorConfigSchema.parse(parsed);
  return {
    ...config,
    runners: config.runners.map((runner) => ({
      ...runner,
      config: path.isAbsolute(runner.config) ? runner.config : path.resolve(path.dirname(absolute), runner.config),
    })),
  };
}
