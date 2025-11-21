import { createCoreClosures } from './closures.js';
import { createHttpClosures, type HttpClosureOptions } from './http.js';
import { registerBundlePreset, createBundleClosures, listBundlePresets } from './bundleRegistry.js';

// Register built-in bundle presets.
registerBundlePreset('core', () => createCoreClosures());
registerBundlePreset('http', (options) => createHttpClosures(options as HttpClosureOptions));

export { registerBundlePreset, createBundleClosures, listBundlePresets };
