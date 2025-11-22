import fs from 'node:fs/promises';
import path from 'node:path';

export type SecretMap = Record<string, string>;

export interface SecretsConfig {
  inline?: Record<string, string>;
  env?: Record<string, string>;
  files?: Array<{ key: string; path: string; encoding?: BufferEncoding }>;
  dotenv?: { path?: string; encoding?: BufferEncoding; required?: boolean };
}

async function parseDotenv(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<Record<string, string>> {
  const content = await fs.readFile(filePath, { encoding });
  const lines = content.split(/\r?\n/);
  const out: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) out[key] = value;
  }
  return out;
}

export async function resolveSecrets(config: SecretsConfig | undefined, configDir: string): Promise<SecretMap> {
  const secrets: SecretMap = {};
  if (!config) return secrets;

  if (config.dotenv) {
    const dotenvPath = config.dotenv.path
      ? path.isAbsolute(config.dotenv.path)
        ? config.dotenv.path
        : path.resolve(configDir, config.dotenv.path)
      : path.join(configDir, '.env');
    try {
      const parsed = await parseDotenv(dotenvPath, config.dotenv.encoding ?? 'utf8');
      Object.assign(secrets, parsed);
    } catch (error) {
      if (config.dotenv.required) {
        throw new Error(`Failed to load dotenv file at ${dotenvPath}: ${(error as Error).message}`);
      }
    }
  }

  if (config.inline) {
    Object.assign(secrets, config.inline);
  }

  if (config.env) {
    for (const [key, envName] of Object.entries(config.env)) {
      const value = process.env[envName];
      if (value !== undefined) {
        secrets[key] = value;
      }
    }
  }

  if (config.files) {
    for (const file of config.files) {
      const filePath = path.isAbsolute(file.path) ? file.path : path.resolve(configDir, file.path);
      const content = await fs.readFile(filePath, { encoding: file.encoding ?? 'utf8' });
      secrets[file.key] = typeof content === 'string' ? content.replace(/\r?\n$/, '') : (content as any);
    }
  }

  return secrets;
}

export function applySecrets(value: unknown, secrets: SecretMap): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => applySecrets(item, secrets));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = applySecrets(v, secrets);
    }
    return result;
  }
  if (typeof value === 'string') {
    return value.replace(/\$\{secrets\.([A-Za-z0-9_\-]+)\}/g, (match, key) => {
      if (secrets[key] === undefined) {
        throw new Error(`Secret "${key}" is not defined`);
      }
      return secrets[key];
    });
  }
  return value;
}
