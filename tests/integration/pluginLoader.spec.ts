import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, afterAll } from 'vitest';
import { createRunner, validateConfig } from '../../packages/rule-loom-runner/src/index.js';
import { resetLoadedPlugins } from '../../packages/rule-loom-runner/src/pluginLoader.js';
import { resetClosureRegistry } from '../../packages/rule-loom-runner/src/closureRegistry.js';

const exampleConfig = path.resolve('examples/plugin-runner.yml');
const examplePluginDir = path.resolve('examples/plugins/example-plugin');

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rule-loom-plugin-test-'));

async function prepareConfig(): Promise<string> {
  const targetPluginDir = path.join(tempDir, 'plugins', 'example-plugin');
  await fs.mkdir(targetPluginDir, { recursive: true });
  await fs.cp(examplePluginDir, targetPluginDir, { recursive: true });

  const contents = await fs.readFile(exampleConfig, 'utf8');
  const configPath = path.join(tempDir, 'config.yml');
  await fs.writeFile(configPath, contents, 'utf8');
  return configPath;
}

describe('plugin loader', () => {
  afterAll(async () => {
    resetLoadedPlugins();
    resetClosureRegistry();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('loads plugin from file source, validates config, and executes flow', async () => {
    const configPath = await prepareConfig();

    const validation = await validateConfig(configPath);
    expect(validation.valid).toBe(true);

    const instance = await createRunner(configPath);
    let result;
    try {
      result = await instance.engine.execute('hello-flow', {}, { logger: instance.logger });
    } catch (error) {
      // Surface stack for easier debugging in CI logs.
      // eslint-disable-next-line no-console
      console.error(error);
      throw error;
    } finally {
      await instance?.close();
    }

    expect(result.lastResult).toBe(5);
  });
});
