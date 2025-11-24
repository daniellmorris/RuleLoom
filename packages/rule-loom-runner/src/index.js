import { EventEmitter } from 'node:events';
import RuleLoomEngine from 'rule-loom-engine';
import { buildClosures } from './closures.js';
import { createLogger } from 'rule-loom-lib';
import { readRunnerConfigFile, parseRunnerConfig, } from './config.js';
import { createPlaceholderHttpApp, } from 'rule-loom-core/inputs';
import { initializeInputs } from './inputPlugins.js';
import { RunnerValidationError, validateRunnerConfig } from './validator.js';
import { parsePluginSpecs } from './pluginSpecs.js';
import { loadRuleLoomPlugins } from './pluginLoader.js';
import { getRegisteredClosures } from './closureRegistry.js';
import { applySecrets, resolveSecrets } from './secrets.js';
function normalizeFlows(flows) {
    return flows.map((flow) => ({
        name: flow.name,
        description: flow.description,
        steps: flow.steps,
    }));
}
async function instantiateEngine(closures, flows, _logger, pluginClosures = []) {
    const engine = new RuleLoomEngine();
    const allClosures = [...pluginClosures, ...closures];
    engine.registerClosures(allClosures);
    engine.registerFlows(normalizeFlows(flows));
    return engine;
}
export async function createRunner(configPath) {
    const { rawConfig, configDir, configPath: absolutePath } = await readRunnerConfigFile(configPath);
    const secrets = await resolveSecrets(rawConfig.secrets, configDir);
    const resolvedConfig = applySecrets(rawConfig, secrets);
    const preliminaryLogger = createLogger(rawConfig?.logger?.level ?? 'info');
    const pluginSpecs = parsePluginSpecs(rawConfig?.plugins ?? []);
    await loadRuleLoomPlugins(pluginSpecs, { logger: preliminaryLogger, configDir });
    const config = parseRunnerConfig(resolvedConfig);
    const logger = createLogger(config.logger?.level ?? 'info');
    const closures = await buildClosures(config.closures ?? [], configDir, logger);
    const pluginClosures = getRegisteredClosures();
    const validation = validateRunnerConfig(config, [...pluginClosures, ...closures]);
    if (!validation.valid) {
        for (const issue of validation.issues) {
            logger.error?.(`Validation issue [${issue.level}] ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}${issue.flow ? ` (flow: ${issue.flow})` : ''}`);
        }
        throw new RunnerValidationError(validation);
    }
    const engine = await instantiateEngine(closures, config.flows, logger, pluginClosures);
    const events = new EventEmitter();
    const { httpApp, scheduler, cleanup } = await initializeInputs(config.inputs, engine, logger, config.metadata, events);
    const app = httpApp ?? createPlaceholderHttpApp(logger);
    let server;
    const listen = async (port, host = '127.0.0.1') => {
        const resolvedPort = port ?? Number(process.env.RULE_LOOM_PORT ?? 3000);
        if (server) {
            throw new Error('Runner is already listening.');
        }
        server = await new Promise((resolve, reject) => {
            const srv = app.listen(resolvedPort, host, () => {
                logger.info(`RuleLoom Runner listening on port ${resolvedPort}`);
                resolve(srv);
            });
            srv.on('error', reject);
        });
        return server;
    };
    const close = async () => {
        if (scheduler) {
            await scheduler.stop();
        }
        if (server) {
            await new Promise((resolve, reject) => {
                server?.close((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            server = undefined;
        }
        await cleanup();
    };
    return {
        engine,
        logger,
        config,
        configPath: absolutePath,
        app,
        listen,
        close,
        scheduler,
        events,
    };
}
export async function startRunner(options) {
    const instance = await createRunner(options.configPath);
    const server = await instance.listen(options.portOverride, options.host);
    return { instance, server };
}
export async function validateConfig(configPath) {
    const { rawConfig, configDir } = await readRunnerConfigFile(configPath);
    const secrets = await resolveSecrets(rawConfig.secrets, configDir);
    const resolvedConfig = applySecrets(rawConfig, secrets);
    const preliminaryLogger = createLogger(rawConfig?.logger?.level ?? 'info');
    const pluginSpecs = parsePluginSpecs(rawConfig?.plugins ?? []);
    await loadRuleLoomPlugins(pluginSpecs, { logger: preliminaryLogger, configDir });
    const config = parseRunnerConfig(resolvedConfig);
    const logger = createLogger(config.logger?.level ?? 'info');
    const closures = await buildClosures(config.closures ?? [], configDir, logger);
    const pluginClosures = getRegisteredClosures();
    return validateRunnerConfig(config, [...pluginClosures, ...closures]);
}
export { getHttpInput, getSchedulerInput } from './config.js';
export { RunnerValidationError } from './validator.js';
export { generateManifest, readManifest } from './manifest.js';
//# sourceMappingURL=index.js.map