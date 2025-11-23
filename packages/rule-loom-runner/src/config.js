import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import { getInputSchema } from 'rule-loom-core/inputs';
import { logLevelSchema, flowSchema, templateClosureSchema, moduleClosureSchema, flowClosureSchema } from './schemas.js';
import { pluginSpecSchema } from './pluginSpecs.js';
export const closureSchema = z.union([templateClosureSchema, moduleClosureSchema, flowClosureSchema]);
export function parseClosureConfigs(raw) {
    if (raw === undefined || raw === null)
        return [];
    return z.array(closureSchema).parse(raw);
}
export function createRunnerConfigSchema() {
    const inputSchema = getInputSchema();
    const secretsSchema = z
        .object({
        inline: z.record(z.string()).optional(),
        env: z.record(z.string()).optional(),
        files: z
            .array(z.object({
            key: z.string().min(1),
            path: z.string().min(1),
            encoding: z.string().optional(),
        }))
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
        secrets: secretsSchema,
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
export function parseRunnerConfig(rawConfig) {
    const schema = createRunnerConfigSchema();
    return schema.parse(rawConfig);
}
export function getHttpInput(config) {
    const entry = config.inputs.find((input) => input.type === 'http');
    return entry?.type === 'http' ? entry : undefined;
}
export function getSchedulerInput(config) {
    const entry = config.inputs.find((input) => input.type === 'scheduler');
    return entry?.type === 'scheduler' ? entry : undefined;
}
export async function readRunnerConfigFile(configPath) {
    const absolutePath = path.resolve(configPath);
    const file = await fs.readFile(absolutePath, 'utf8');
    const parsed = (yaml.load(file) ?? {});
    return {
        config: parsed,
        rawConfig: parsed,
        configPath: absolutePath,
        configDir: path.dirname(absolutePath),
    };
}
export async function importClosureModule(modulePath, baseDir) {
    const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(baseDir, modulePath);
    return import(pathToFileURL(resolved).href);
}
//# sourceMappingURL=config.js.map