import { z } from 'zod';

export const filePluginSpecSchema = z.object({
  source: z.literal('file'),
  path: z.string().min(1),
  integrity: z.string().optional(),
  name: z.string().optional(),
});

export const npmPluginSpecSchema = z.object({
  source: z.literal('npm'),
  name: z.string().min(1),
  version: z.string().optional(),
  registry: z.string().url().optional(),
  integrity: z.string().optional(),
});

export const storePluginSpecSchema = z.object({
  source: z.literal('store'),
  name: z.string().min(1),
  version: z.string().optional(),
  registry: z.string().url().optional(),
  integrity: z.string().optional(),
});

export const githubPluginSpecSchema = z.object({
  source: z.literal('github'),
  repo: z.string().min(1),
  ref: z.string().min(1),
  path: z.string().optional(),
  integrity: z.string().optional(),
  name: z.string().optional(),
});

export const pluginSpecSchema = z.union([
  filePluginSpecSchema,
  npmPluginSpecSchema,
  storePluginSpecSchema,
  githubPluginSpecSchema,
]);

export type PluginSpec = z.infer<typeof pluginSpecSchema>;

export function parsePluginSpecs(raw: unknown): PluginSpec[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('plugins must be an array when provided');
  }
  return raw.map((entry, index) => {
    if (typeof entry === 'string') {
      // Shorthand string treated as file path or npm name depending on prefix.
      if (entry.startsWith('.') || entry.startsWith('/') || entry.startsWith('file:')) {
        return filePluginSpecSchema.parse({ source: 'file', path: entry.replace(/^file:/, '') });
      }
      return npmPluginSpecSchema.parse({ source: 'npm', name: entry });
    }
    const result = pluginSpecSchema.safeParse(entry);
    if (!result.success) {
      throw new Error(`Invalid plugin spec at index ${index}: ${result.error.message}`);
    }
    return result.data;
  });
}
