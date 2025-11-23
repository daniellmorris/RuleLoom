import { getInputPlugins } from 'rule-loom-core/inputs';
export async function initializeInputs(inputs, engine, logger, metadata, events) {
    const cleanupFns = [];
    const pluginMap = new Map(getInputPlugins().map((plugin) => [plugin.type, plugin]));
    let httpApp;
    let scheduler;
    for (const input of inputs) {
        const plugin = pluginMap.get(input.type);
        if (!plugin) {
            throw new Error(`No input plugin registered for type "${input.type}".`);
        }
        const context = { logger, engine, metadata, events };
        const result = await plugin.initialize(input, context);
        if (result?.http) {
            if (httpApp) {
                throw new Error('Only a single HTTP input is currently supported.');
            }
            httpApp = result.http.app;
        }
        if (result?.scheduler) {
            if (scheduler) {
                throw new Error('Only a single scheduler input is currently supported.');
            }
            scheduler = result.scheduler;
        }
        if (result?.cleanup) {
            cleanupFns.push(result.cleanup);
        }
    }
    return {
        httpApp,
        scheduler,
        cleanup: async () => {
            for (const cleanup of cleanupFns.reverse()) {
                await Promise.resolve(cleanup()).catch(() => undefined);
            }
        },
    };
}
//# sourceMappingURL=inputPlugins.js.map